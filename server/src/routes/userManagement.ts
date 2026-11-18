import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/User';
import { sendEmail } from '../utils/email';
import { hashToken } from '../utils/crypto';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);
router.use(requireRole('coordinator'));

// GET /api/users — list users in this tenant
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const role = req.query.role as string | undefined;
    const filter: Record<string, unknown> = { tenantId };
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('firstName lastName email role status createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json(users);
  })
);

// POST /api/users — invite a new user (event_staff or event_client)
router.post(
  '/',
  validate(z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: z.string().email(),
    role: z.enum(['event_staff', 'event_client', 'coordinator']),
  })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { firstName, lastName, email, role } = req.body as { firstName: string; lastName: string; email: string; role: string };

    const existing = await User.findOne({ email: email.toLowerCase(), tenantId });
    if (existing) throw new AppError('Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.', 409);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      tenantId,
      firstName,
      lastName,
      email: email.toLowerCase(),
      role,
      status: 'active',
      emailVerified: false,
      magicLinkTokenHash: hashToken(rawToken),
      magicLinkExpires: new Date(Date.now() + 7 * 24 * 60 * 60_000), // 7 days for invite
    });

    const link = `${env.CLIENT_URL}/magic-login/${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Einladung zur Eventplattform',
      html: `
        <p>Hallo ${firstName},</p>
        <p>Sie wurden zur Eventplattform eingeladen. Klicken Sie auf den Link, um sich zu registrieren:</p>
        <p><a href="${link}">Zur Plattform anmelden</a> (7 Tage gültig)</p>
      `,
    });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  })
);

// PATCH /api/users/:id/status — activate or deactivate a user
router.patch(
  '/:id/status',
  validate(z.object({ status: z.enum(['active', 'inactive']) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw new AppError('Benutzer nicht gefunden.', 404);

    user.status = req.body.status;
    if (req.body.status === 'inactive') {
      user.refreshTokenHashes = [];
    }
    await user.save();
    res.json({ message: 'Status aktualisiert.', status: user.status });
  })
);

// DELETE /api/users/:id — remove a user (only event_staff / event_client)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw new AppError('Benutzer nicht gefunden.', 404);
    if (user.role === 'coordinator') throw new AppError('Koordinatoren können nicht gelöscht werden.', 403);

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Benutzer gelöscht.' });
  })
);

// POST /api/users/:id/resend-invite — resend a magic link invite
router.post(
  '/:id/resend-invite',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw new AppError('Benutzer nicht gefunden.', 404);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.magicLinkTokenHash = hashToken(rawToken);
    user.magicLinkExpires = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    await user.save();

    const link = `${env.CLIENT_URL}/magic-login/${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Neuer Einladungslink – Eventplattform',
      html: `<p><a href="${link}">Zur Plattform anmelden</a> (7 Tage gültig)</p>`,
    });

    res.json({ message: 'Einladungslink erneut gesendet.' });
  })
);

export default router;
