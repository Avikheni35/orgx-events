import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { EventApplication } from '../models/EventApplication';
import { Event } from '../models/Event';
import { StaffProfile } from '../models/StaffProfile';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(requireAuth);

// ── Coordinator: list all pending applications for an event ───────────────────
router.get('/event/:eventId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const apps = await EventApplication.find({
    eventId: req.params.eventId,
    tenantId,
    status: 'pending',
  }).sort({ appliedAt: 1 }).lean();
  res.json(apps);
}));

// ── Event staff: list available events (staffing / planning / confirmed status) ─
router.get('/available-events', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const events = await Event.find({
    tenantId,
    status: { $in: ['planning', 'staffing', 'confirmed'] },
  }).sort({ startDate: 1 }).lean();
  res.json(events);
}));

// ── Event staff: list own applications ────────────────────────────────────────
router.get('/mine', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const profile = await StaffProfile.findOne({ userId, tenantId: req.user!.tenantId }).lean();
  if (!profile) throw new AppError('Staff profile not found', 404);
  const apps = await EventApplication.find({ staffProfileId: profile._id }).sort({ appliedAt: -1 }).lean();
  res.json(apps);
}));

// ── Event staff: apply for an event ──────────────────────────────────────────
const applySchema = z.object({
  eventId: z.string().min(1),
  note: z.string().max(500).optional(),
});

router.post('/', requireRole('event_staff'), validate(applySchema), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { eventId, note } = req.body as z.infer<typeof applySchema>;

  const [event, profile] = await Promise.all([
    Event.findOne({ _id: eventId, tenantId }),
    StaffProfile.findOne({ userId: req.user!.userId, tenantId }),
  ]);

  if (!event) throw new AppError('Event not found', 404);
  if (!['planning', 'staffing', 'confirmed'].includes(event.status)) {
    throw new AppError('This event is not accepting applications', 400);
  }
  if (!profile) throw new AppError('Staff profile not found', 404);

  // Upsert: re-applying after withdrawal just flips status back
  const app = await EventApplication.findOneAndUpdate(
    { eventId: new Types.ObjectId(eventId), staffProfileId: profile._id },
    {
      $set: {
        tenantId,
        eventName: event.name,
        staffName: `${profile.firstName} ${profile.lastName}`,
        staffEmail: profile.email,
        note,
        status: 'pending',
        appliedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json(app);
}));

// ── Event staff: withdraw application ─────────────────────────────────────────
router.delete('/:id', requireRole('event_staff'), asyncHandler(async (req, res) => {
  const profile = await StaffProfile.findOne({ userId: req.user!.userId, tenantId: req.user!.tenantId }).lean();
  if (!profile) throw new AppError('Staff profile not found', 404);

  const app = await EventApplication.findOneAndUpdate(
    { _id: req.params.id, staffProfileId: profile._id, status: 'pending' },
    { status: 'withdrawn' },
    { new: true }
  );
  if (!app) throw new AppError('Application not found or already withdrawn', 404);
  res.json({ message: 'Application withdrawn' });
}));

export default router;
