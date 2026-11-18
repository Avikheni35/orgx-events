import { Router } from 'express';
import { Types } from 'mongoose';
import { Payment } from '../models/Payment';
import { EventTimesheet } from '../models/EventTimesheet';
import { StaffProfile } from '../models/StaffProfile';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { notify } from '../utils/notify';

const MONTH_NAMES = ['','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'coordinator'));

// ── List payments (filterable by month/year/status/staffProfileId) ────────────

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { year, month, status, staffProfileId } = req.query as Record<string, string>;

  const query: Record<string, unknown> = { tenantId };
  if (year)            query.year   = parseInt(year);
  if (month)           query.month  = parseInt(month);
  if (status)          query.status = status;
  if (staffProfileId)  query.staffProfileId = new Types.ObjectId(staffProfileId);

  const payments = await Payment.find(query).sort({ year: -1, month: -1, staffName: 1 }).lean();
  res.json({ payments, total: payments.length });
}));

// ── Generate payment records from approved timesheets for a given month ────────
// Upserts one record per staff member that has approved timesheets in that month.

router.post('/generate', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { year, month } = req.body as { year: number; month: number };

  if (!year || !month || month < 1 || month > 12) throw new AppError('Valid year and month (1–12) are required', 400);

  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);

  // Aggregate approved timesheets for this month grouped by staff
  const agg = await EventTimesheet.aggregate([
    {
      $match: {
        tenantId: new Types.ObjectId(tenantId.toString()),
        status: 'approved',
        plannedStartTime: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: '$staffProfileId',
        staffName:         { $first: '$staffName' },
        totalHoursWorked:  { $sum: '$totalHours' },
        basePayFromTimesheets: { $sum: '$grossPay' },
        eventIds:          { $addToSet: '$eventId' },
      },
    },
  ]);

  if (agg.length === 0) {
    res.json({ generated: 0, payments: [], message: 'No approved timesheets found for this period.' });
    return;
  }

  const results = [];
  for (const row of agg) {
    const basePay    = Math.round(row.basePayFromTimesheets * 100) / 100;
    const totalAmount = basePay; // starts equal; coordinator can adjust

    const payment = await Payment.findOneAndUpdate(
      { tenantId, staffProfileId: row._id, year, month },
      {
        $setOnInsert: { tenantId, staffProfileId: row._id, status: 'pending' },
        $set: {
          staffName: row.staffName,
          totalHoursWorked:      Math.round(row.totalHoursWorked * 100) / 100,
          totalEventsWorked:     row.eventIds.length,
          basePayFromTimesheets: basePay,
          basePay,
          totalAmount,
          year,
          month,
        },
      },
      { upsert: true, new: true }
    );
    results.push(payment);
  }

  res.json({ generated: results.length, payments: results });
}));

// ── Get one staff member's payment history ────────────────────────────────────

router.get('/staff/:staffProfileId', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const payments = await Payment.find({
    tenantId,
    staffProfileId: new Types.ObjectId(req.params.staffProfileId),
  }).sort({ year: -1, month: -1 }).lean();
  res.json({ payments });
}));

// ── Edit payment (bonus, deductions, basePay override, notes) ─────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!payment) throw new AppError('Payment record not found', 404);
  if (payment.status === 'paid') throw new AppError('Cannot edit a paid payment', 400);

  const { basePay, bonus, deductions, notes } = req.body as {
    basePay?: number; bonus?: number; deductions?: number; notes?: string;
  };

  if (basePay    !== undefined) payment.basePay    = basePay;
  if (bonus      !== undefined) payment.bonus      = bonus;
  if (deductions !== undefined) payment.deductions = deductions;
  if (notes      !== undefined) payment.notes      = notes;

  payment.totalAmount = Math.round((payment.basePay + payment.bonus - payment.deductions) * 100) / 100;
  await payment.save();
  res.json(payment);
}));

// ── Mark as paid ──────────────────────────────────────────────────────────────

router.post('/:id/pay', asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!payment) throw new AppError('Payment record not found', 404);
  if (payment.status === 'paid') throw new AppError('Already marked as paid', 400);

  payment.status = 'paid';
  payment.paidAt = new Date();
  payment.paidByUserId = new Types.ObjectId(req.user!.userId);
  await payment.save();
  const sp = await StaffProfile.findById(payment.staffProfileId).lean();
  if (sp?.userId) {
    notify({
      tenantId: payment.tenantId,
      recipientId: sp.userId,
      type: 'payment_paid',
      title: 'Zahlung erhalten',
      body: `Deine Zahlung für ${MONTH_NAMES[payment.month]} ${payment.year} wurde verbucht. € ${payment.totalAmount.toFixed(2)}`,
      link: '/event-staff/timesheets',
    });
  }
  res.json(payment);
}));

// ── Revert paid → pending (coordinator correction) ───────────────────────────

router.post('/:id/revert', asyncHandler(async (req, res) => {
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId, status: 'paid' },
    { $set: { status: 'pending' }, $unset: { paidAt: 1, paidByUserId: 1 } },
    { new: true }
  );
  if (!payment) throw new AppError('Payment not found or not in paid state', 404);
  res.json(payment);
}));

export default router;
