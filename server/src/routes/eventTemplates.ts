import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { EventTemplate } from '../models/EventTemplate';

const router = Router();
router.use(requireAuth);
router.use(requireRole('coordinator'));

const positionSchema = z.object({
  title: z.string().min(1).max(100),
  roleType: z.string().max(80).optional(),
  headcount: z.number().int().min(1).default(1),
  skills: z.array(z.string()).default([]),
  payRatePerHour: z.number().min(0),
  billingRatePerHour: z.number().min(0).optional(),
  dresscode: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  durationHours: z.number().min(0.5).default(8),
  breakMinutes: z.number().int().min(0).default(30),
});

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other']),
  description: z.string().max(500).optional(),
  requiresClientApproval: z.boolean().default(false),
  positions: z.array(positionSchema).default([]),
});

// GET /api/event-templates
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const templates = await EventTemplate.find({ tenantId }).sort({ name: 1 }).lean();
    res.json(templates);
  })
);

// GET /api/event-templates/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tpl = await EventTemplate.findOne({ _id: req.params.id, tenantId }).lean();
    if (!tpl) throw new AppError('Template not found', 404);
    res.json(tpl);
  })
);

// POST /api/event-templates
router.post(
  '/',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tpl = await EventTemplate.create({
      tenantId,
      createdBy: req.user!.userId,
      ...req.body,
    });
    res.status(201).json(tpl);
  })
);

// PUT /api/event-templates/:id
router.put(
  '/:id',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tpl = await EventTemplate.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!tpl) throw new AppError('Template not found', 404);
    res.json(tpl);
  })
);

// DELETE /api/event-templates/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tpl = await EventTemplate.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!tpl) throw new AppError('Template not found', 404);
    res.json({ message: 'Template deleted' });
  })
);

export default router;
