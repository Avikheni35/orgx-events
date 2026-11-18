import { Router } from 'express';
import { Types } from 'mongoose';
import { Notification } from '../models/Notification';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

// ── Unread count (for badge) ──────────────────────────────────────────────────

router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipientId: new Types.ObjectId(req.user!.userId),
    read: false,
  });
  res.json({ count });
}));

// ── List notifications ────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { limit = '30' } = req.query as Record<string, string>;
  const notifications = await Notification.find({
    recipientId: new Types.ObjectId(req.user!.userId),
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, parseInt(limit)))
    .lean();
  res.json({ notifications });
}));

// ── Mark one as read ──────────────────────────────────────────────────────────

router.post('/:id/read', asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipientId: new Types.ObjectId(req.user!.userId) },
    { read: true }
  );
  res.json({ ok: true });
}));

// ── Mark all as read ──────────────────────────────────────────────────────────

router.post('/read-all', asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipientId: new Types.ObjectId(req.user!.userId), read: false },
    { read: true }
  );
  res.json({ updated: result.modifiedCount });
}));

export default router;
