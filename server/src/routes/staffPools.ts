import { Router } from 'express';
import { z } from 'zod';
import { StaffPool } from '../models/StaffPool';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Types } from 'mongoose';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'coordinator'));

const poolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

router.get('/', asyncHandler(async (req, res) => {
  const query = { tenantId: req.user!.tenantId };
  const [pools, total] = await Promise.all([
    StaffPool.find(query).sort({ name: 1 }).lean(),
    StaffPool.countDocuments(query),
  ]);
  const withCount = pools.map((p) => ({ ...p, memberCount: p.memberIds.length }));
  res.json({ pools: withCount, total });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const pool = await StaffPool.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!pool) throw new AppError('Staff pool not found', 404);
  res.json(pool);
}));

router.post('/', validate(poolSchema), asyncHandler(async (req, res) => {
  const pool = await StaffPool.create({ ...req.body, tenantId: req.user!.tenantId, createdBy: req.user!.userId });
  res.status(201).json(pool);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const pool = await StaffPool.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $set: req.body },
    { new: true }
  );
  if (!pool) throw new AppError('Staff pool not found', 404);
  res.json(pool);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const pool = await StaffPool.findOneAndDelete({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!pool) throw new AppError('Staff pool not found', 404);
  res.json({ message: 'Pool deleted' });
}));

router.post('/:id/members', asyncHandler(async (req, res) => {
  const { staffProfileId } = req.body as { staffProfileId: string };
  const pool = await StaffPool.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $addToSet: { memberIds: new Types.ObjectId(staffProfileId) } },
    { new: true }
  );
  if (!pool) throw new AppError('Staff pool not found', 404);
  res.json(pool);
}));

router.delete('/:id/members/:staffProfileId', asyncHandler(async (req, res) => {
  const pool = await StaffPool.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $pull: { memberIds: new Types.ObjectId(req.params.staffProfileId) } },
    { new: true }
  );
  if (!pool) throw new AppError('Staff pool not found', 404);
  res.json(pool);
}));

export default router;
