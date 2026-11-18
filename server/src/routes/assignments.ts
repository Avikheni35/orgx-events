import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { Event } from '../models/Event';
import { StaffProfile } from '../models/StaffProfile';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { hashToken } from '../utils/crypto';
import { sendEmail } from '../utils/email';
import { env } from '../config/env';
import { EventApplication } from '../models/EventApplication';
import { StaffAvailability } from '../models/StaffAvailability';
import { notify } from '../utils/notify';

const router = Router();
router.use(requireAuth);

const assignSchema = z.object({
  eventId: z.string().min(1),
  positionId: z.string().min(1),
  slotId: z.string().min(1),
  staffProfileId: z.string().min(1),
  // minutes offset from getTimezoneOffset() — negative means ahead of UTC (e.g. CEST = -120)
  tzOffset: z.number().int().optional().default(0),
  // coordinator can force an invite even if staff would otherwise be auto-confirmed
  forceInvite: z.boolean().optional().default(false),
});

// ── All active assignments overlapping a time window (for availability check) ─
router.get('/period', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const { start, end } = req.query as { start: string; end: string };
  if (!start || !end) throw new AppError('start and end query params required', 400);
  const tenantId = req.user!.tenantId;
  const assignments = await EventStaffAssignment.find({
    tenantId,
    status: { $nin: ['declined', 'cancelled'] },
    slotStart: { $lt: new Date(end) },
    slotEnd:   { $gt: new Date(start) },
  }).lean();
  // Group by staffProfileId so the client can do O(1) lookups
  const byStaff: Record<string, unknown[]> = {};
  for (const a of assignments) {
    const key = a.staffProfileId.toString();
    if (!byStaff[key]) byStaff[key] = [];
    byStaff[key].push(a);
  }
  res.json(byStaff);
}));

// ── Event staff: own assignments ──────────────────────────────────────────────
router.get('/mine', asyncHandler(async (req, res) => {
  const { StaffProfile } = await import('../models/StaffProfile');
  const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
  if (!profile) { res.json([]); return; }
  const assignments = await EventStaffAssignment.find({
    staffProfileId: profile._id,
  }).sort({ slotStart: 1 }).lean();
  res.json(assignments);
}));

// ── Public: get invitation details by token (no auth) ────────────────────────
router.get('/invitation/:token', asyncHandler(async (req, res) => {
  const { hashToken } = await import('../utils/crypto');
  const hash = hashToken(req.params.token);
  const assignment = await EventStaffAssignment.findOne({ inviteToken: hash }).lean();
  if (!assignment || !assignment.inviteExpires || assignment.inviteExpires < new Date()) {
    throw new AppError('Invalid or expired invitation', 400);
  }
  res.json(assignment);
}));

// ── Workforce sheet — all assignments for an event ────────────────────────────
router.get('/event/:eventId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const assignments = await EventStaffAssignment.find({ eventId: req.params.eventId, tenantId }).sort({ slotStart: 1 }).lean();
  res.json(assignments);
}));

// ── Assign staff to a slot ────────────────────────────────────────────────────
router.post('/', requireRole('super_admin', 'coordinator'), validate(assignSchema), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { eventId, positionId, slotId, staffProfileId } = req.body as z.infer<typeof assignSchema>;

  const [event, staff] = await Promise.all([
    Event.findOne({ _id: eventId, tenantId }),
    StaffProfile.findOne({ _id: staffProfileId, tenantId }),
  ]);

  if (!event) throw new AppError('Event not found', 404);
  if (!staff) throw new AppError('Staff profile not found', 404);
  if (['completed', 'cancelled'].includes(event.status)) throw new AppError('Cannot assign staff to a completed or cancelled event', 400);

  const position = event.positions.find((p) => p._id.toString() === positionId);
  if (!position) throw new AppError('Position not found', 404);
  const slot = position.slots.find((s) => s._id.toString() === slotId);
  if (!slot) throw new AppError('Time slot not found', 404);

  // Check slot is not already full
  const confirmed = await EventStaffAssignment.countDocuments({
    tenantId, eventId, slotId, status: { $nin: ['declined', 'cancelled'] },
  });
  if (confirmed >= position.headcount) throw new AppError('Slot is fully staffed', 400);

  // Check staff has no conflicting assignment (time overlap across all events)
  const conflict = await EventStaffAssignment.findOne({
    staffProfileId: new Types.ObjectId(staffProfileId),
    status: { $nin: ['declined', 'cancelled'] },
    slotStart: { $lt: slot.endTime },
    slotEnd:   { $gt: slot.startTime },
  }).lean();
  if (conflict) {
    throw new AppError(
      `${staff.firstName} ${staff.lastName} ist bereits für "${conflict.eventName}" (${new Date(conflict.slotStart).toLocaleTimeString('de-DE', { timeStyle: 'short' })}–${new Date(conflict.slotEnd).toLocaleTimeString('de-DE', { timeStyle: 'short' })}) eingeplant.`,
      409
    );
  }

  // Auto-confirm if: worker applied, OR directAssignable=true, OR availability covers this slot
  const application = await EventApplication.findOne({
    eventId: new Types.ObjectId(eventId),
    staffProfileId: new Types.ObjectId(staffProfileId),
    status: 'pending',
  }).lean();

  // Check availability calendar for the slot's date/time
  let isAvailableForSlot = false;
  const availability = await StaffAvailability.findOne({ staffProfileId: new Types.ObjectId(staffProfileId) }).lean();
  if (availability) {
    // Convert UTC slot time → client's local time using the tzOffset they sent.
    // getTimezoneOffset() is negative for zones ahead of UTC (CEST = -120),
    // so: localMs = utcMs - tzOffset * 60_000  (subtracting a negative adds the right amount)
    const { tzOffset = 0 } = req.body as z.infer<typeof assignSchema>;
    const slotUtc = new Date(slot.startTime);
    const localMs = slotUtc.getTime() - tzOffset * 60_000;
    const localSlot = new Date(localMs); // a UTC Date whose UTC fields now read as local values
    const slotDateStr = `${localSlot.getUTCFullYear()}-${String(localSlot.getUTCMonth() + 1).padStart(2, '0')}-${String(localSlot.getUTCDate()).padStart(2, '0')}`;
    const slotDayOfWeek = localSlot.getUTCDay();
    const slotHHMM = `${String(localSlot.getUTCHours()).padStart(2, '0')}:${String(localSlot.getUTCMinutes()).padStart(2, '0')}`;

    const dateOverride = availability.dateOverrides.find(
      (o) => new Date(o.date).toISOString().split('T')[0] === slotDateStr
    );

    if (dateOverride) {
      if (dateOverride.available) {
        // No time range = available all day; time range = must cover the slot start
        isAvailableForSlot = (!dateOverride.startTime || !dateOverride.endTime)
          ? true
          : slotHHMM >= dateOverride.startTime && slotHHMM < dateOverride.endTime;
      }
    } else {
      const weekDay = availability.weeklyPattern.find((p) => p.dayOfWeek === slotDayOfWeek);
      if (weekDay?.available) {
        isAvailableForSlot = (!weekDay.startTime || !weekDay.endTime)
          ? true
          : slotHHMM >= weekDay.startTime && slotHHMM < weekDay.endTime;
      }
    }
  }

  const { forceInvite = false } = req.body as z.infer<typeof assignSchema>;
  const hasApplied = !forceInvite && (!!application || !!staff.directAssignable || isAvailableForSlot);
  const rawToken = crypto.randomBytes(32).toString('hex');

  const assignment = await EventStaffAssignment.create({
    tenantId,
    eventId: new Types.ObjectId(eventId),
    eventName: event.name,
    positionId: new Types.ObjectId(positionId),
    positionTitle: position.title,
    slotId: new Types.ObjectId(slotId),
    slotStart: slot.startTime,
    slotEnd: slot.endTime,
    staffProfileId: new Types.ObjectId(staffProfileId),
    staffName: `${staff.firstName} ${staff.lastName}`,
    staffEmail: staff.email,
    payRatePerHour: position.payRatePerHour,
    billingRatePerHour: position.billingRatePerHour,
    status: hasApplied ? 'confirmed' : 'invited',
    inviteToken: hasApplied ? undefined : hashToken(rawToken),
    inviteExpires: hasApplied ? undefined : new Date(Date.now() + 7 * 24 * 60 * 60_000),
    createdBy: req.user!.userId,
  });

  if (hasApplied) {
    // Notify worker their application was accepted
    sendEmail({
      to: staff.email,
      subject: `Bewerbung angenommen: ${event.name}`,
      html: `<p>Ihre Bewerbung für <strong>${event.name}</strong> (${position.title}) wurde angenommen. Sie sind bestätigt!</p>`,
    }).catch(() => {});
    if (staff.userId) {
      notify({
        tenantId,
        recipientId: staff.userId,
        type: 'assignment_confirmed',
        title: 'Einsatz bestätigt',
        body: `Du bist für "${event.name}" (${position.title}) am ${new Date(slot.startTime).toLocaleDateString('de-DE')} eingeplant.`,
        link: '/event-staff/assignments',
      });
    }
  } else {
    // Worker didn't apply — send invitation for them to confirm/decline
    const link = `${env.CLIENT_URL}/event-staff/invitations/${rawToken}`;
    sendEmail({
      to: staff.email,
      subject: `Einsatzeinladung: ${event.name}`,
      html: `<p>Sie wurden für <strong>${event.name}</strong> (${position.title}) eingeplant.</p><p><a href="${link}">Hier bestätigen oder ablehnen</a></p>`,
    }).catch(() => {});
  }

  res.status(201).json({ ...assignment.toObject(), hasApplied });
}));

// ── Update assignment status (coordinator) ────────────────────────────────────
router.patch('/:id/status', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const { status } = req.body as { status: string };
  const assignment = await EventStaffAssignment.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { status },
    { new: true }
  );
  if (!assignment) throw new AppError('Assignment not found', 404);
  res.json(assignment);
}));

// ── Respond to invitation (authenticated event_staff — no token needed) ──────
router.patch('/:id/respond', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const { response, note } = req.body as { response: 'confirmed' | 'declined'; note?: string };
  if (!['confirmed', 'declined'].includes(response)) throw new AppError('Invalid response', 400);

  const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
  if (!profile) throw new AppError('Staff profile not found', 404);

  const assignment = await EventStaffAssignment.findOne({
    _id: req.params.id,
    staffProfileId: profile._id,
    status: 'invited',
  });
  if (!assignment) throw new AppError('Invitation not found or already responded', 404);

  assignment.status = response;
  assignment.staffNote = note;
  assignment.inviteToken = undefined;
  assignment.inviteExpires = undefined;
  await assignment.save();

  if (response === 'confirmed' && profile.userId) {
    notify({
      tenantId: assignment.tenantId,
      recipientId: profile.userId,
      type: 'assignment_confirmed',
      title: 'Einsatz bestätigt',
      body: `Deine Teilnahme an "${assignment.eventName}" ist bestätigt.`,
      link: '/event-staff/assignments',
    });
  }

  res.json({ message: response === 'confirmed' ? 'Einsatz bestätigt.' : 'Einsatz abgelehnt.', assignment });
}));

// ── Respond to invitation via token (public — no auth needed) ─────────────────
router.post('/respond/:token', asyncHandler(async (req, res) => {
  const { response, note } = req.body as { response: 'confirmed' | 'declined'; note?: string };
  if (!['confirmed', 'declined'].includes(response)) throw new AppError('Invalid response', 400);

  const hash = hashToken(req.params.token);
  const assignment = await EventStaffAssignment.findOne({ inviteToken: hash, status: 'invited' });
  if (!assignment || !assignment.inviteExpires || assignment.inviteExpires < new Date()) {
    throw new AppError('Invalid or expired invitation', 400);
  }

  assignment.status = response;
  assignment.staffNote = note;
  assignment.inviteToken = undefined;
  assignment.inviteExpires = undefined;
  await assignment.save();

  res.json({ message: response === 'confirmed' ? 'Einsatz bestätigt.' : 'Einsatz abgelehnt.', assignment });
}));

// ── Check-in / Check-out (event_staff portal or coordinator) ──────────────────
router.post('/:id/checkin', requireAuth, asyncHandler(async (req, res) => {
  const { lat, lng } = req.body as { lat?: number; lng?: number };
  const query: Record<string, unknown> = { _id: req.params.id };

  if (req.user!.role === 'event_staff') {
    const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
    if (!profile) throw new AppError('Staff profile not found', 404);
    query.staffProfileId = profile._id;
  } else {
    query.tenantId = req.user!.tenantId;
  }

  const assignment = await EventStaffAssignment.findOneAndUpdate(
    query,
    { checkInTime: new Date(), ...(lat && lng ? { checkInLocation: { lat, lng } } : {}), actualStartTime: new Date() },
    { new: true }
  );
  if (!assignment) throw new AppError('Assignment not found', 404);
  res.json(assignment);
}));

router.post('/:id/checkout', requireAuth, asyncHandler(async (req, res) => {
  const { actualBreakMinutes } = req.body as { actualBreakMinutes?: number };
  const query: Record<string, unknown> = { _id: req.params.id };

  if (req.user!.role === 'event_staff') {
    const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
    if (!profile) throw new AppError('Staff profile not found', 404);
    query.staffProfileId = profile._id;
  } else {
    query.tenantId = req.user!.tenantId;
  }

  const assignment = await EventStaffAssignment.findOneAndUpdate(
    query,
    { checkOutTime: new Date(), actualEndTime: new Date(), actualBreakMinutes: actualBreakMinutes ?? 0 },
    { new: true }
  );
  if (!assignment) throw new AppError('Assignment not found', 404);
  res.json(assignment);
}));

// ── Remove assignment ─────────────────────────────────────────────────────────
router.delete('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const assignment = await EventStaffAssignment.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId, status: { $in: ['invited', 'confirmed', 'declined'] } },
    { status: 'cancelled' },
    { new: true }
  );
  if (!assignment) throw new AppError('Assignment not found or cannot be cancelled', 404);

  // If the shift was confirmed, remove the auto-added date override from the worker's availability.
  // Use a ±1 day UTC window to handle any server/client timezone offset (no real TZ is >UTC±24).
  if (assignment.status === 'cancelled') {
    const slotDate = new Date(assignment.slotStart);
    const dayStart = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate() - 1));
    const dayEnd   = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate() + 2));
    await StaffAvailability.updateOne(
      { staffProfileId: assignment.staffProfileId },
      { $pull: { dateOverrides: { date: { $gte: dayStart, $lt: dayEnd }, note: assignment.eventName } } }
    ).catch(() => {});
  }

  res.json({ message: 'Assignment cancelled' });
}));

export default router;
