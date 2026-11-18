import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { StaffRating } from '../models/StaffRating';
import { StaffProfile } from '../models/StaffProfile';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(requireAuth);

async function recalcRating(staffProfileId: string | Types.ObjectId, tenantId: string) {
  const result = await StaffRating.aggregate([
    { $match: { staffProfileId: new Types.ObjectId(String(staffProfileId)), tenantId } },
    { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
  ]);
  const avg = result[0]?.avg ?? 0;
  const count = result[0]?.count ?? 0;
  await StaffProfile.findByIdAndUpdate(staffProfileId, {
    'rating.average': Math.round(avg * 10) / 10,
    'rating.count': count,
  });
}

// ── Coordinator: create or update a rating ────────────────────────────────────
router.post('/',
  requireRole('super_admin', 'coordinator'),
  validate(z.object({
    staffProfileId: z.string().min(1),
    eventId: z.string().min(1),
    score: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const { staffProfileId, eventId, score, comment } = req.body as {
      staffProfileId: string; eventId: string; score: number; comment?: string;
    };

    // Verify the assignment exists for this event + staff in this tenant
    const assignment = await EventStaffAssignment.findOne({
      tenantId,
      eventId: new Types.ObjectId(eventId),
      staffProfileId: new Types.ObjectId(staffProfileId),
      status: { $in: ['confirmed', 'worked'] },
    }).lean();
    if (!assignment) throw new AppError('Kein bestätigter Einsatz gefunden', 404);

    const coordinator = req.user!;
    const rating = await StaffRating.findOneAndUpdate(
      { staffProfileId: new Types.ObjectId(staffProfileId), eventId: new Types.ObjectId(eventId) },
      {
        $set: {
          tenantId,
          staffProfileId: new Types.ObjectId(staffProfileId),
          eventId: new Types.ObjectId(eventId),
          eventName: assignment.eventName,
          coordinatorId: new Types.ObjectId(coordinator.userId),
          coordinatorName: `${coordinator.userId}`,
          score,
          comment: comment ?? null,
        },
      },
      { upsert: true, new: true }
    );

    await recalcRating(staffProfileId, tenantId);
    res.status(201).json(rating);
  })
);

// ── Coordinator: get all ratings for a staff member ───────────────────────────
router.get('/staff/:staffProfileId',
  requireRole('super_admin', 'coordinator'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const ratings = await StaffRating.find({
      tenantId,
      staffProfileId: new Types.ObjectId(req.params.staffProfileId),
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ratings });
  })
);

// ── Coordinator: get all ratings given for an event ───────────────────────────
router.get('/event/:eventId',
  requireRole('super_admin', 'coordinator'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const ratings = await StaffRating.find({
      tenantId,
      eventId: new Types.ObjectId(req.params.eventId),
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ratings });
  })
);

export default router;
