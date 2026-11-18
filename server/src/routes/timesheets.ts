import { Router } from 'express';
import { Types } from 'mongoose';
import { EventTimesheet } from '../models/EventTimesheet';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { Event } from '../models/Event';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { notify } from '../utils/notify';
import { peers } from '../utils/serviceClient';
import { StaffProfile } from '../models/StaffProfile';
import { calcHours } from '../utils/timeUtils';

const router = Router();
router.use(requireAuth);

// ── List timesheets (flat, for overview) ─────────────────────────────────────

router.get('/', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, eventId, staffProfileId, clientId, year, month, page = '1', limit = '50' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId };
  if (status) query.status = status;
  if (eventId) query.eventId = eventId;
  if (staffProfileId) query.staffProfileId = staffProfileId;
  if (clientId) query.clientId = clientId;
  if (year && month) {
    const from = new Date(Number(year), Number(month) - 1, 1);
    const to   = new Date(Number(year), Number(month), 1);
    query.approvedAt = { $gte: from, $lt: to };
  }
  const p = Math.max(1, parseInt(page)), l = Math.min(200, parseInt(limit));
  const [timesheets, total] = await Promise.all([
    EventTimesheet.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    EventTimesheet.countDocuments(query),
  ]);
  res.json({ timesheets, total, page: p, pages: Math.ceil(total / l) });
}));

// ── Get / generate event-level timesheet view ─────────────────────────────────
// Returns all assignments for the event merged with their timesheet records.

router.get('/event/:eventId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { eventId } = req.params;

  const [event, assignments, timesheets] = await Promise.all([
    Event.findOne({ _id: eventId, tenantId }).lean(),
    EventStaffAssignment.find({ eventId: new Types.ObjectId(eventId), tenantId, status: { $in: ['confirmed', 'worked', 'no_show'] } }).sort({ slotStart: 1 }).lean(),
    EventTimesheet.find({ eventId: new Types.ObjectId(eventId), tenantId }).lean(),
  ]);

  if (!event) throw new AppError('Event not found', 404);

  const tsMap = new Map(timesheets.map((t) => [t.assignmentId.toString(), t]));
  const entries = assignments.map((a) => ({
    assignment: a,
    timesheet: tsMap.get(a._id.toString()) ?? null,
  }));

  res.json({ event, entries });
}));

// ── Generate / upsert timesheets for all workers of an event ──────────────────

router.post('/event/:eventId/generate', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { eventId } = req.params;

  const [event, assignments] = await Promise.all([
    Event.findOne({ _id: eventId, tenantId }).lean(),
    EventStaffAssignment.find({ eventId: new Types.ObjectId(eventId), tenantId, status: { $in: ['confirmed', 'worked', 'no_show'] } }).lean(),
  ]);

  if (!event) throw new AppError('Event not found', 404);
  if (assignments.length === 0) throw new AppError('No confirmed assignments found for this event', 400);

  const results = [];
  for (const a of assignments) {
    const actualStart = a.checkInTime ?? a.slotStart;
    const actualEnd   = a.checkOutTime ?? a.slotEnd;
    const breakTaken  = !!a.checkInTime && !!a.checkOutTime && a.actualBreakMinutes > 0;
    const breakMins   = a.actualBreakMinutes ?? 0;
    const totalHours  = calcHours(new Date(actualStart), new Date(actualEnd), breakTaken, breakMins);
    const grossPay    = Math.round(totalHours * a.payRatePerHour * 100) / 100;

    const ts = await EventTimesheet.findOneAndUpdate(
      { assignmentId: a._id, tenantId },
      {
        $setOnInsert: {
          tenantId, eventId: a.eventId, eventName: a.eventName,
          assignmentId: a._id, staffProfileId: a.staffProfileId, staffName: a.staffName,
          clientId: (event as { clientId?: Types.ObjectId }).clientId ?? new Types.ObjectId(),
          clientName: (event as { clientName?: string }).clientName ?? '',
          positionTitle: a.positionTitle,
          plannedStartTime: a.slotStart, plannedEndTime: a.slotEnd,
          plannedBreakMinutes: a.actualBreakMinutes ?? 0,
          status: 'pending',
        },
        $set: {
          actualStartTime: actualStart, actualEndTime: actualEnd,
          breakTaken, actualBreakMinutes: breakMins,
          totalHours, grossPay, billingRatePerHour: a.billingRatePerHour,
        },
      },
      { upsert: true, new: true }
    );
    results.push(ts);
  }

  res.json({ generated: results.length, timesheets: results });
}));

// ── Staff view: own timesheets ────────────────────────────────────────────────
// Must be before /:id so Express doesn't swallow it

router.get('/my/list', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const { StaffProfile } = await import('../models/StaffProfile');
  const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
  if (!profile) { res.json([]); return; }
  const timesheets = await EventTimesheet.find({ staffProfileId: profile._id }).sort({ plannedStartTime: -1 }).lean();
  res.json(timesheets);
}));

// ── Get single timesheet ──────────────────────────────────────────────────────

router.get('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const ts = await EventTimesheet.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!ts) throw new AppError('Timesheet not found', 404);
  res.json(ts);
}));

// ── Edit times, break, rating — recalculates hours + pay ─────────────────────

router.patch('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const ts = await EventTimesheet.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!ts) throw new AppError('Timesheet not found', 404);

  const { actualStartTime, actualEndTime, breakTaken, actualBreakMinutes, ratingByCoordinator, ratingNote } = req.body as {
    actualStartTime?: string; actualEndTime?: string;
    breakTaken?: boolean; actualBreakMinutes?: number;
    ratingByCoordinator?: number; ratingNote?: string;
  };

  if (actualStartTime !== undefined) ts.actualStartTime = new Date(actualStartTime);
  if (actualEndTime   !== undefined) ts.actualEndTime   = new Date(actualEndTime);
  if (breakTaken      !== undefined) ts.breakTaken      = breakTaken;
  if (actualBreakMinutes !== undefined) ts.actualBreakMinutes = actualBreakMinutes;
  if (ratingByCoordinator !== undefined) ts.ratingByCoordinator = ratingByCoordinator;
  if (ratingNote      !== undefined) ts.ratingNote      = ratingNote;

  // Recalculate hours and pay when time fields are present
  if (ts.actualStartTime && ts.actualEndTime) {
    ts.totalHours = calcHours(ts.actualStartTime, ts.actualEndTime, ts.breakTaken, ts.actualBreakMinutes);
    ts.grossPay   = Math.round(ts.totalHours * ts.payRatePerHour * 100) / 100;
  }

  await ts.save();
  res.json(ts);
}));

// ── Approve ───────────────────────────────────────────────────────────────────

router.post('/:id/approve', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const ts = await EventTimesheet.findOneAndUpdate(
    { _id: req.params.id, tenantId, status: 'pending' },
    { status: 'approved', approvedBy: req.user!.userId, approvedAt: new Date() },
    { new: true }
  );
  if (!ts) throw new AppError('Timesheet not found or already processed', 404);

  const sp = await StaffProfile.findById(ts.staffProfileId).lean();

  // Compute net pay from staff tax rate
  const taxRate    = sp?.taxRate ?? ts.taxRate ?? 0;
  const grossCents = Math.round(ts.grossPay * 100);
  const taxCents   = Math.round(grossCents * taxRate);
  const deductionsCents = sp?.deductions?.reduce((s, d) => s + d.amountCents, 0) ?? 0;
  const netCents   = Math.max(0, grossCents - taxCents - deductionsCents);

  await EventTimesheet.updateOne({ _id: ts._id }, {
    taxRate, deductionsCents, netPay: netCents / 100,
  });

  // Push to M3 payroll (fire-and-forget with sync tracking)
  const syncId = `m2_ts_${ts._id}`;
  const approvedAt = ts.approvedAt ?? new Date();
  const year  = approvedAt.getFullYear();
  const month = approvedAt.getMonth() + 1;

  await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'pending', syncId });

  peers.m3.pushPayrollEntry(tenantId.toString(), {
    syncId,
    m2StaffId:     ts.staffProfileId.toString(),
    staffName:     ts.staffName,
    firstName:     sp?.firstName ?? '',
    lastName:      sp?.lastName  ?? '',
    email:         sp?.email     ?? '',
    grossCents,
    taxCents,
    deductionCents: deductionsCents,
    netCents,
    hoursWorked:   ts.totalHours,
    periodYear:    year,
    periodMonth:   month,
    timesheetId:   ts._id.toString(),
  }).then(async (result) => {
    if (result) {
      await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'synced', syncedAt: new Date(), m3PayrollId: result.payrollId });
    } else {
      await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'failed', syncError: 'M3 unreachable or integration disabled' });
    }
  }).catch(async () => {
    await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'failed', syncError: 'Unexpected push error' });
  });

  if (sp?.userId) {
    notify({
      tenantId: ts.tenantId,
      recipientId: sp.userId,
      type: 'timesheet_approved',
      title: 'Stundenzettel genehmigt',
      body: `Dein Stundenzettel für "${ts.eventName}" wurde genehmigt. ${ts.totalHours.toFixed(1)} Std. · € ${ts.grossPay.toFixed(2)}`,
      link: '/event-staff/timesheets',
    });
  }
  res.json(ts);
}));

// ── Approve all for an event ──────────────────────────────────────────────────

router.post('/event/:eventId/approve-all', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId  = req.user!.tenantId!;
  const approvedBy = req.user!.userId;
  const approvedAt = new Date();

  const pending = await EventTimesheet.find({
    eventId: new Types.ObjectId(req.params.eventId),
    tenantId,
    status: 'pending',
  }).lean();

  let approved = 0;
  for (const ts of pending) {
    const sp = await StaffProfile.findById(ts.staffProfileId).lean();
    const taxRate         = sp?.taxRate ?? ts.taxRate ?? 0;
    const grossCents      = Math.round(ts.grossPay * 100);
    const taxCents        = Math.round(grossCents * taxRate);
    const deductionsCents = sp?.deductions?.reduce((s, d) => s + d.amountCents, 0) ?? 0;
    const netCents        = Math.max(0, grossCents - taxCents - deductionsCents);

    await EventTimesheet.updateOne({ _id: ts._id }, {
      status: 'approved', approvedBy, approvedAt,
      taxRate, deductionsCents, netPay: netCents / 100,
    });
    approved++;
  }

  res.json({ approved });
}));

// ── Dispute ───────────────────────────────────────────────────────────────────

router.post('/:id/dispute', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason: string };
  if (!reason) throw new AppError('Dispute reason is required', 400);
  const ts = await EventTimesheet.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId, status: { $in: ['pending', 'approved'] } },
    { status: 'disputed', disputeReason: reason },
    { new: true }
  );
  if (!ts) throw new AppError('Timesheet not found', 404);
  res.json(ts);
}));

export default router;
