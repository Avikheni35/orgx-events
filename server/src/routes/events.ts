import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Event, IEvent } from '../models/Event';
import { EventClient } from '../models/EventClient';
import { Venue } from '../models/Venue';
import { Tenant } from '../models/Tenant';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { EventTimesheet } from '../models/EventTimesheet';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { htmlToPdf } from '../utils/pdf';
import { buildEventReportHtml } from '../utils/eventReportPdf';
import { sendEmail } from '../utils/email';

const router = Router();
router.use(requireAuth);

const positionSchema = z.object({
  title: z.string().min(1),
  roleType: z.string().optional(),
  headcount: z.number().int().min(1),
  skills: z.array(z.string()).default([]),
  payRatePerHour: z.number().positive(),
  billingRatePerHour: z.number().positive().optional(),
  dresscode: z.string().optional(),
  notes: z.string().optional(),
  slots: z.array(z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    breakMinutes: z.number().int().min(0).default(0),
    notes: z.string().optional(),
  })).default([]),
});

const eventSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().min(1),
  venueId: z.string().optional(),
  type: z.enum(['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other']).default('corporate'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  description: z.string().optional(),
  budget: z.number().positive().optional(),
  plannedRevenue: z.number().positive().optional(),
  positions: z.array(positionSchema).default([]),
});

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, clientId, venueId, from, to, page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId };
  if (status) query.status = status;
  if (clientId) query.clientId = clientId;
  if (venueId) query.venueId = venueId;
  if (from || to) {
    query.startDate = {};
    if (from) (query.startDate as Record<string, Date>).$gte = new Date(from);
    if (to) (query.startDate as Record<string, Date>).$lte = new Date(to);
  }
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [events, total] = await Promise.all([
    Event.find(query).sort({ startDate: -1 }).skip((p - 1) * l).limit(l).lean(),
    Event.countDocuments(query),
  ]);
  res.json({ events, total, page: p, pages: Math.ceil(total / l) });
}));

// ── Get one ───────────────────────────────────────────────────────────────────
router.get('/:id', requireRole('super_admin', 'coordinator', 'event_staff'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  res.json(event);
}));

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', requireRole('super_admin', 'coordinator'), validate(eventSchema), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { clientId, venueId, ...rest } = req.body as z.infer<typeof eventSchema>;

  const [client, tenant] = await Promise.all([
    EventClient.findOne({ _id: clientId, tenantId }).lean(),
    Tenant.findById(tenantId).lean(),
  ]);
  if (!client) throw new AppError('Event client not found', 404);
  if (!tenant) throw new AppError('Tenant not found', 404);

  let venueName: string | undefined;
  if (venueId) {
    const venue = await Venue.findOne({ _id: venueId, tenantId }).lean();
    venueName = venue?.name;
  }

  // Sequential event number per tenant
  const count = await Event.countDocuments({ tenantId });
  const eventNumber = `EVT-${String(count + 1).padStart(5, '0')}`;

  const event = await Event.create({
    ...rest,
    tenantId,
    eventNumber,
    clientId: new Types.ObjectId(clientId),
    clientName: client.name,
    venueId: venueId ? new Types.ObjectId(venueId) : undefined,
    venueName,
    createdBy: req.user!.userId,
  });

  res.status(201).json(event);
}));

// ── Update ────────────────────────────────────────────────────────────────────
router.patch('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  if (event.status === 'completed' || event.status === 'cancelled') {
    throw new AppError('Cannot edit a completed or cancelled event', 400);
  }
  Object.assign(event, req.body);
  await event.save();
  res.json(event);
}));

// ── Status transition ─────────────────────────────────────────────────────────
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['staffing', 'cancelled'],
  staffing: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

router.post('/:id/status', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const { status } = req.body as { status: string };
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);

  const allowed = STATUS_TRANSITIONS[event.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot transition from ${event.status} to ${status}`, 400);
  }

  event.status = status as IEvent['status'];
  if (status === 'completed') {
    event.completedAt = new Date();
    await createTimesheets(event);
  }
  if (status === 'cancelled') event.cancelledAt = new Date();
  await event.save();
  res.json(event);

  // Auto-send report email when event completes (fire-and-forget)
  if (status === 'completed') {
    sendEventReport(event).catch((err: unknown) =>
      console.error('[M2] Auto-report email failed:', err)
    );
  }
}));

async function createTimesheets(event: IEvent) {
  const assignments = await EventStaffAssignment.find({
    eventId: event._id,
    status: { $in: ['confirmed', 'worked'] },
  }).lean();

  for (const asgn of assignments) {
    const exists = await EventTimesheet.findOne({ assignmentId: asgn._id });
    if (exists) continue;

    const slotDuration = (asgn.slotEnd.getTime() - asgn.slotStart.getTime()) / (1000 * 60 * 60);
    const breakH = (asgn.actualBreakMinutes || 0) / 60;
    const totalH = Math.max(0, parseFloat((slotDuration - breakH).toFixed(2)));
    const grossPay = parseFloat((totalH * asgn.payRatePerHour).toFixed(2));

    await EventTimesheet.create({
      tenantId: event.tenantId,
      eventId: event._id,
      eventName: event.name,
      assignmentId: asgn._id,
      staffProfileId: asgn.staffProfileId,
      staffName: asgn.staffName,
      clientId: event.clientId,
      clientName: event.clientName,
      positionTitle: asgn.positionTitle,
      plannedStartTime: asgn.slotStart,
      plannedEndTime: asgn.slotEnd,
      plannedBreakMinutes: 0,
      actualStartTime: asgn.actualStartTime,
      actualEndTime: asgn.actualEndTime,
      actualBreakMinutes: asgn.actualBreakMinutes || 0,
      totalHours: totalH,
      payRatePerHour: asgn.payRatePerHour,
      grossPay,
      billingRatePerHour: asgn.billingRatePerHour,
    });

    await EventStaffAssignment.updateOne({ _id: asgn._id }, { status: 'worked' });
  }
}

// ── Positions ─────────────────────────────────────────────────────────────────
router.post('/:id/positions', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  event.positions.push(req.body);
  await event.save();
  res.json(event);
}));

router.patch('/:id/positions/:positionId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  const pos = event.positions.find((p) => p._id.toString() === req.params.positionId);
  if (!pos) throw new AppError('Position not found', 404);
  Object.assign(pos, req.body);
  await event.save();
  res.json(event);
}));

router.delete('/:id/positions/:positionId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  const idx = event.positions.findIndex((p) => p._id.toString() === req.params.positionId);
  if (idx === -1) throw new AppError('Position not found', 404);
  event.positions.splice(idx, 1);
  await event.save();
  res.json(event);
}));

// ── Notes ─────────────────────────────────────────────────────────────────────
router.post('/:id/notes', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);
  event.notes.push({ text: req.body.text, createdBy: new Types.ObjectId(req.user!.userId), createdByName: req.body.createdByName || 'Unknown', createdAt: new Date() } as never);
  await event.save();
  res.json(event);
}));

// ── Report: generate PDF (download) ──────────────────────────────────────────
router.get('/:id/report', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);

  const [timesheets, tenant] = await Promise.all([
    EventTimesheet.find({ eventId: event._id }).sort({ staffName: 1 }).lean(),
    Tenant.findById(event.tenantId).lean(),
  ]);

  const tenantName = (tenant as { name?: string } | null)?.name ?? 'Organisation';
  const html = buildEventReportHtml(event, timesheets as never, tenantName);
  const pdf = await htmlToPdf(html);

  const filename = `Abschlussbericht_${event.eventNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
}));

// ── Report: email to primary client contact ───────────────────────────────────
router.post('/:id/report/email', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!event) throw new AppError('Event not found', 404);

  await sendEventReport(event);
  res.json({ message: 'Bericht wurde per E-Mail versendet.', reportEmailedAt: event.reportEmailedAt });
}));

async function sendEventReport(event: IEvent) {
  const [timesheets, client, tenant] = await Promise.all([
    EventTimesheet.find({ eventId: event._id }).sort({ staffName: 1 }).lean(),
    EventClient.findById(event.clientId).lean(),
    Tenant.findById(event.tenantId).lean(),
  ]);

  const tenantName = (tenant as { name?: string } | null)?.name ?? 'Organisation';
  const html = buildEventReportHtml(event, timesheets as never, tenantName);
  const pdf = await htmlToPdf(html);

  const primaryContact = (client?.contacts ?? []).find((c) => c.isPrimary) ?? client?.contacts?.[0];
  const recipientEmail = primaryContact?.email ?? (client as { email?: string } | null)?.email;

  if (recipientEmail) {
    await sendEmail({
      to: recipientEmail,
      subject: `Abschlussbericht: ${event.name} (${event.eventNumber})`,
      html: `
        <p>Sehr geehrte Damen und Herren,</p>
        <p>im Anhang finden Sie den Abschlussbericht für das Event <strong>${event.name}</strong> (${event.eventNumber}).</p>
        <p>Mit freundlichen Grüßen,<br>${tenantName}</p>
      `,
      attachments: [{ filename: `Abschlussbericht_${event.eventNumber}.pdf`, content: pdf }],
    });
  }

  event.reportEmailedAt = new Date();
  await event.save();
}

export default router;
