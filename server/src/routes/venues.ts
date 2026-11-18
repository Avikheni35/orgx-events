import { Router } from 'express';
import { z } from 'zod';
import { Venue } from '../models/Venue';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'coordinator'));

const venueSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['indoor', 'outdoor', 'hybrid']).default('indoor'),
  capacity: z.number().int().positive().optional(),
  address: z.object({ street: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }).optional(),
  facilities: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, status = 'active', page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId, status };
  if (search) query.name = new RegExp(search, 'i');
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [venues, total] = await Promise.all([
    Venue.find(query).sort({ name: 1 }).skip((p - 1) * l).limit(l).lean(),
    Venue.countDocuments(query),
  ]);
  res.json({ venues, total, page: p, pages: Math.ceil(total / l) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const venue = await Venue.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!venue) throw new AppError('Venue not found', 404);
  res.json(venue);
}));

router.post('/', validate(venueSchema), asyncHandler(async (req, res) => {
  const venue = await Venue.create({ ...req.body, tenantId: req.user!.tenantId, createdBy: req.user!.userId });
  res.status(201).json(venue);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const venue = await Venue.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!venue) throw new AppError('Venue not found', 404);
  res.json(venue);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const venue = await Venue.findOneAndDelete({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!venue) throw new AppError('Venue not found', 404);
  res.json({ message: 'Venue deleted' });
}));

export default router;
