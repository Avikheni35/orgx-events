import { Router } from 'express';
import { z } from 'zod';
import { StaffAvailability } from '../models/StaffAvailability';
import { StaffProfile } from '../models/StaffProfile';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(requireAuth);

const weeklySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  available: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const dateOverrideSchema = z.object({
  date: z.string(),
  available: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  note: z.string().max(200).optional(),
});

async function getProfileForUser(userId: string, tenantId: string) {
  const profile = await StaffProfile.findOne({ userId, tenantId }).lean();
  if (!profile) throw new AppError('Staff profile not found for this user', 404);
  return profile;
}

// ── Event staff: get own availability ────────────────────────────────────────
router.get('/mine', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const profile = await getProfileForUser(req.user!.userId, req.user!.tenantId!);
  let avail = await StaffAvailability.findOne({ staffProfileId: profile._id }).lean() as unknown;
  if (!avail) {
    // Auto-create default (Mon–Fri available)
    const created = await StaffAvailability.create({ tenantId: req.user!.tenantId, staffProfileId: profile._id });
    avail = created.toObject();
  }
  res.json(avail);
}));

// ── Event staff: update weekly pattern ───────────────────────────────────────
router.put('/mine/weekly', requireRole('event_staff'),
  validate(z.object({ weeklyPattern: z.array(weeklySlotSchema).length(7) })),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.user!.userId, req.user!.tenantId!);
    const avail = await StaffAvailability.findOneAndUpdate(
      { staffProfileId: profile._id },
      { $set: { tenantId: req.user!.tenantId, weeklyPattern: req.body.weeklyPattern } },
      { upsert: true, new: true }
    );
    res.json(avail);
  })
);

// ── Event staff: upsert a date override ───────────────────────────────────────
router.put('/mine/override', requireRole('event_staff'),
  validate(dateOverrideSchema),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.user!.userId, req.user!.tenantId!);
    const dateStart = new Date(req.body.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    // Remove existing override for this date, then push new one
    await StaffAvailability.updateOne(
      { staffProfileId: profile._id },
      { $pull: { dateOverrides: { date: { $gte: dateStart, $lt: dateEnd } } } },
      { upsert: true }
    );
    const avail = await StaffAvailability.findOneAndUpdate(
      { staffProfileId: profile._id },
      { $push: { dateOverrides: { ...req.body, date: dateStart } } },
      { upsert: true, new: true }
    );
    res.json(avail);
  })
);

// ── Event staff: delete a date override ──────────────────────────────────────
router.delete('/mine/override/:overrideId', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const profile = await getProfileForUser(req.user!.userId, req.user!.tenantId!);
  await StaffAvailability.updateOne(
    { staffProfileId: profile._id },
    { $pull: { dateOverrides: { _id: req.params.overrideId } } }
  );
  res.json({ message: 'Override removed' });
}));

// ── Coordinator: view availability for a staff member ─────────────────────────
router.get('/staff/:staffProfileId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const avail = await StaffAvailability.findOne({
    staffProfileId: req.params.staffProfileId,
    tenantId: req.user!.tenantId,
  }).lean();
  res.json(avail ?? null);
}));

// ── Coordinator: overview grid — all staff + availability for a date range ─────
router.get('/overview', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end) throw new AppError('start and end query params required', 400);

  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError('Invalid date format', 400);
  }

  const tenantId = req.user!.tenantId!;

  const [profiles, availRecords, assignments] = await Promise.all([
    StaffProfile.find({ tenantId, status: 'active' })
      .select('firstName lastName photoUrl email')
      .lean(),
    StaffAvailability.find({
      tenantId,
    }).lean(),
    EventStaffAssignment.find({
      tenantId,
      slotStart: { $lte: endDate },
      slotEnd: { $gte: startDate },
      status: { $in: ['confirmed', 'invited'] },
    }).select('staffProfileId eventName slotStart slotEnd status').lean(),
  ]);

  const availByProfile = new Map(availRecords.map(a => [String(a.staffProfileId), a]));
  const assignmentsByProfile = assignments.reduce<Record<string, typeof assignments>>((acc, a) => {
    const key = String(a.staffProfileId);
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  const staff = profiles.map(p => ({
    profileId: String(p._id),
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    photoUrl: (p as { photoUrl?: string }).photoUrl,
    availability: availByProfile.get(String(p._id)) ?? null,
    assignments: (assignmentsByProfile[String(p._id)] ?? []).map(a => ({
      eventName: a.eventName,
      slotStart: a.slotStart,
      slotEnd: a.slotEnd,
      status: a.status,
    })),
  }));

  res.json({ staff });
}));

export default router;
