import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { StaffProfile } from '../models/StaffProfile';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

function generatePassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 5; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('') + '!';
}

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  skills: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, status = 'active', skill, poolId, email, page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId };
  if (status) query.status = status;
  if (email) query.email = email.toLowerCase();
  if (search) {
    query.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }
  if (skill) query.skills = skill;
  if (poolId) query.poolIds = poolId;
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));

  const [profiles, total] = await Promise.all([
    StaffProfile.find(query).sort({ lastName: 1, firstName: 1 }).skip((p - 1) * l).limit(l).lean(),
    StaffProfile.countDocuments(query),
  ]);

  res.json({ profiles, total, page: p, pages: Math.ceil(total / l) });
}));

router.get('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const profile = await StaffProfile.findOne({ _id: req.params.id, tenantId });
  if (!profile) throw new AppError('Staff profile not found', 404);
  res.json(profile);
}));

router.post('/', requireRole('super_admin', 'coordinator'), validate(profileSchema), asyncHandler(async (req, res) => {
  const profile = await StaffProfile.create({ ...req.body, tenantId: req.user!.tenantId, createdBy: req.user!.userId });
  res.status(201).json(profile);
}));

router.patch('/:id', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const profile = await StaffProfile.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!profile) throw new AppError('Staff profile not found', 404);
  res.json(profile);
}));

// Add certification
router.post('/:id/certifications', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const profile = await StaffProfile.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!profile) throw new AppError('Staff profile not found', 404);
  profile.certifications.push(req.body);
  await profile.save();
  res.json(profile);
}));

router.delete('/:id/certifications/:certId', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const profile = await StaffProfile.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!profile) throw new AppError('Staff profile not found', 404);
  const idx = profile.certifications.findIndex((c) => c._id.toString() === req.params.certId);
  if (idx === -1) throw new AppError('Certification not found', 404);
  profile.certifications.splice(idx, 1);
  await profile.save();
  res.json(profile);
}));

// ── Create portal account for a staff profile ─────────────────────────────────

router.post('/:id/create-account', requireRole('super_admin', 'coordinator'), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const profile = await StaffProfile.findOne({ _id: req.params.id, tenantId });
  if (!profile) throw new AppError('Staff profile not found', 404);

  const temporaryPassword = generatePassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  // Check if a user account already exists for this email + tenant
  let user = await User.findOne({ email: profile.email.toLowerCase(), tenantId });

  if (user) {
    // Update existing account password and ensure correct role
    await User.updateOne({ _id: user._id }, { $set: { passwordHash, role: 'event_staff', status: 'active' } });
  } else {
    user = await User.create({
      email:        profile.email.toLowerCase(),
      firstName:    profile.firstName,
      lastName:     profile.lastName,
      role:         'event_staff',
      tenantId:     new Types.ObjectId(tenantId.toString()),
      passwordHash,
      status:       'active',
      emailVerified: true,
      refreshTokenHashes: [],
      failedLoginAttempts: 0,
    });
  }

  // Link userId back to profile
  profile.userId = user._id;
  await profile.save();

  res.json({ email: profile.email, temporaryPassword });
}));

export default router;
