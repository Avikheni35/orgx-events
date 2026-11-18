import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';

const router = Router();
router.use(requireAuth);

const m2FeaturesSchema = z.object({
  publicApplicationFlow:    z.boolean().optional(),
  autoAssignOnAvailability: z.boolean().optional(),
  autoApproveTimesheets:    z.boolean().optional(),
  requireCheckinPhoto:      z.boolean().optional(),
  disputeWindowDays:        z.coerce.number().int().min(1).max(90).optional(),
  invoicingEnabled:         z.boolean().optional(),
  paymentGateway:           z.enum(['none','stripe','sepa']).optional(),
  defaultEventVisibility:   z.enum(['private','public']).optional(),
  eventClientPortal:        z.boolean().optional(),
  staffRatingEnabled:       z.boolean().optional(),
});

// GET /api/settings/features
router.get(
  '/features',
  requireRole('coordinator'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) throw new AppError('Tenant context required', 400);
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);
    const flags = (tenant as unknown as Record<string, unknown>).m2FeatureFlags ?? {};
    res.json(flags);
  })
);

// PATCH /api/settings/features
router.patch(
  '/features',
  requireRole('coordinator'),
  validate(m2FeaturesSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    if (!tenantId) throw new AppError('Tenant context required', 400);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      patch[`m2FeatureFlags.${k}`] = v;
    }
    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: patch },
      { new: true }
    );
    if (!tenant) throw new AppError('Tenant not found', 404);
    res.json((tenant as unknown as Record<string, unknown>).m2FeatureFlags ?? {});
  })
);

export default router;
