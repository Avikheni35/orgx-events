import { Router } from 'express';
import { z } from 'zod';
import { EventClient } from '../models/EventClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'coordinator'));

const clientSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['company', 'individual']).default('company'),
  industry: z.string().optional(),
  vatId: z.string().optional(),
  address: z.object({ street: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }).optional(),
  billingAddress: z.object({ street: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }).optional(),
  paymentTermsDays: z.number().int().min(0).default(14),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, status = 'active', page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId, status };
  if (search) query.name = new RegExp(search, 'i');
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [clients, total] = await Promise.all([
    EventClient.find(query).sort({ name: 1 }).skip((p - 1) * l).limit(l).lean(),
    EventClient.countDocuments(query),
  ]);
  res.json({ clients, total, page: p, pages: Math.ceil(total / l) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const client = await EventClient.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!client) throw new AppError('Event client not found', 404);
  res.json(client);
}));

router.post('/', validate(clientSchema), asyncHandler(async (req, res) => {
  const client = await EventClient.create({ ...req.body, tenantId: req.user!.tenantId, createdBy: req.user!.userId });
  res.status(201).json(client);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const client = await EventClient.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!client) throw new AppError('Event client not found', 404);
  res.json(client);
}));

// Add contact
router.post('/:id/contacts', asyncHandler(async (req, res) => {
  const client = await EventClient.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!client) throw new AppError('Event client not found', 404);
  client.contacts.push(req.body);
  await client.save();
  res.json(client);
}));

router.delete('/:id/contacts/:contactId', asyncHandler(async (req, res) => {
  const client = await EventClient.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!client) throw new AppError('Event client not found', 404);
  const idx = client.contacts.findIndex((c) => c._id.toString() === req.params.contactId);
  if (idx === -1) throw new AppError('Contact not found', 404);
  client.contacts.splice(idx, 1);
  await client.save();
  res.json(client);
}));

export default router;
