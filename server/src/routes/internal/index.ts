import { Router } from 'express';
import { requireServiceToken } from '../../middleware/requireServiceToken';
import { asyncHandler } from '../../utils/asyncHandler';
import { StaffProfile } from '../../models/StaffProfile';
import { EventTimesheet } from '../../models/EventTimesheet';
import { EventInvoice } from '../../models/EventInvoice';
import { Payment } from '../../models/Payment';

const router = Router();
router.use(requireServiceToken);

router.get('/health', (_req, res) => {
  res.json({ ok: true, module: 'm2' });
});

// GET /api/internal/staff — M3 fetches active staff for live display (Mode 1)
router.get('/staff', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const staff = await StaffProfile.find({ tenantId, status: 'active' })
    .select('_id firstName lastName email phone skills taxRate contractType deductions status')
    .lean();
  res.json({ staff });
}));

// GET /api/internal/staff/:id — M3 fetches single staff member (Mode 1)
router.get('/staff/:id', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const member = await StaffProfile.findOne({ _id: req.params.id, tenantId })
    .select('_id firstName lastName email phone skills taxRate contractType deductions status ibanEncrypted')
    .lean();
  if (!member) { res.status(404).json({ message: 'Staff member not found' }); return; }
  res.json({ staff: member });
}));

// GET /api/internal/timesheets — M3 fetches approved timesheets for payroll view
router.get('/timesheets', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const { staffProfileId, year, month, syncStatus } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId, status: 'approved' };
  if (staffProfileId) query.staffProfileId = staffProfileId;
  if (syncStatus) query.syncStatus = syncStatus;
  if (year && month) {
    const from = new Date(Number(year), Number(month) - 1, 1);
    const to   = new Date(Number(year), Number(month), 1);
    query.approvedAt = { $gte: from, $lt: to };
  }
  const timesheets = await EventTimesheet.find(query)
    .select('_id staffProfileId staffName totalHours payRatePerHour grossPay taxRate deductionsCents netPay approvedAt syncStatus syncId m3PayrollId eventName')
    .lean();
  res.json({ timesheets });
}));

// GET /api/internal/invoices — M3 fetches sent invoices for AR view
router.get('/invoices', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const { syncStatus, status } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId };
  if (status) query.status = status;
  else query.status = { $in: ['sent', 'paid'] };
  if (syncStatus) query.syncStatus = syncStatus;
  const invoices = await EventInvoice.find(query)
    .select('_id invoiceNumber clientId clientName total subtotal vatAmount dueDate status syncStatus syncId m3InvoiceId eventName invoiceDate')
    .lean();
  res.json({ invoices });
}));

// GET /api/internal/payments — M3 fetches paid status for a given month
router.get('/payments', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const { year, month } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId, status: 'paid', source: 'm3' };
  if (year)  query.year  = Number(year);
  if (month) query.month = Number(month);
  const payments = await Payment.find(query)
    .select('_id staffProfileId staffName year month totalAmount paidAt syncId m3JournalEntryId paidHours totalHours carryForwardHours')
    .lean();
  res.json({ payments });
}));

// GET /api/internal/sync-summary — pending/failed counts for M3 to display
router.get('/sync-summary', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const [pendingTs, failedTs, pendingInv, failedInv] = await Promise.all([
    EventTimesheet.countDocuments({ tenantId, syncStatus: 'pending' }),
    EventTimesheet.countDocuments({ tenantId, syncStatus: 'failed' }),
    EventInvoice.countDocuments({ tenantId, syncStatus: 'pending' }),
    EventInvoice.countDocuments({ tenantId, syncStatus: 'failed' }),
  ]);
  res.json({ timesheets: { pending: pendingTs, failed: failedTs }, invoices: { pending: pendingInv, failed: failedInv } });
}));

// POST /api/internal/trigger-sync — M3 asks M2 to retry pending/failed records
router.post('/trigger-sync', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const { peers } = await import('../../utils/serviceClient');

  const [timesheets, invoices] = await Promise.all([
    EventTimesheet.find({ tenantId, syncStatus: { $in: ['pending', 'failed'] } }).lean(),
    EventInvoice.find({ tenantId, syncStatus: { $in: ['pending', 'failed'] } }).lean(),
  ]);

  let tsOk = 0, tsFail = 0, invOk = 0, invFail = 0;
  const tid = tenantId.toString();

  await Promise.all([
    ...timesheets.map(async (ts) => {
      const sp = await StaffProfile.findById(ts.staffProfileId).lean();
      const taxRate = sp?.taxRate ?? ts.taxRate ?? 0;
      const grossCents = Math.round(ts.grossPay * 100);
      const taxCents = Math.round(grossCents * taxRate);
      const deductionsCents = sp?.deductions?.reduce((s: number, d: { amountCents: number }) => s + d.amountCents, 0) ?? ts.deductionsCents ?? 0;
      const netCents = Math.max(0, grossCents - taxCents - deductionsCents);
      const approvedAt = ts.approvedAt ?? ts.updatedAt ?? new Date();
      const syncId = ts.syncId ?? `m2_ts_${ts._id}`;
      const year = new Date(approvedAt).getFullYear();
      const month = new Date(approvedAt).getMonth() + 1;
      try {
        const result = await peers.m3.pushPayrollEntry(tid, {
          syncId, m2StaffId: ts.staffProfileId.toString(),
          staffName: ts.staffName,
          firstName: sp?.firstName ?? '', lastName: sp?.lastName ?? '', email: sp?.email ?? '',
          grossCents, taxCents, deductionCents: deductionsCents, netCents,
          hoursWorked: ts.totalHours, periodYear: year, periodMonth: month,
          timesheetId: ts._id.toString(),
        });
        if (result) { await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'synced', syncedAt: new Date(), syncId, m3PayrollId: result.payrollId }); tsOk++; }
        else { await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'failed', syncError: 'M3 unreachable' }); tsFail++; }
      } catch { await EventTimesheet.updateOne({ _id: ts._id }, { syncStatus: 'failed', syncError: 'Push error' }); tsFail++; }
    }),
    ...invoices.map(async (inv) => {
      const syncId = inv.syncId ?? `m2_inv_${inv._id}`;
      const lineItems = inv.lineItems.map((li: { description: string; hours: number; ratePerHour: number }) => ({
        description: li.description, quantity: li.hours,
        unitPriceCents: Math.round(li.ratePerHour * 100), vatRate: inv.vatRate,
      }));
      try {
        const result = await peers.m3.pushInvoice(tid, {
          syncId, m2InvoiceId: inv._id.toString(), m2ClientId: inv.clientId.toString(),
          clientName: inv.clientName, clientAddress: inv.clientAddress ? { street: inv.clientAddress } : undefined,
          clientVatId: inv.clientVatId, invoiceNumber: inv.invoiceNumber,
          invoiceDate: new Date(inv.invoiceDate).toISOString().split('T')[0],
          dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
          lineItems, subtotalCents: Math.round(inv.subtotal * 100),
          vatRate: inv.vatRate, vatCents: Math.round(inv.vatAmount * 100),
          totalCents: Math.round(inv.total * 100), notes: inv.notes,
        });
        if (result) { await EventInvoice.updateOne({ _id: inv._id }, { syncStatus: 'synced', syncedAt: new Date(), syncId, m3InvoiceId: result.id }); invOk++; }
        else { await EventInvoice.updateOne({ _id: inv._id }, { syncStatus: 'failed', syncError: 'M3 unreachable' }); invFail++; }
      } catch { await EventInvoice.updateOne({ _id: inv._id }, { syncStatus: 'failed', syncError: 'Push error' }); invFail++; }
    }),
  ]);

  res.json({ timesheets: { ok: tsOk, failed: tsFail }, invoices: { ok: invOk, failed: invFail } });
}));

// POST /api/internal/payment-ack — M3 writes back after SEPA payout (Mode 2 writeback)
router.post('/payment-ack', asyncHandler(async (req, res) => {
  const tenantId = req.internalTenantId!;
  const { staffProfileId, staffName, year, month, netAmountCents, paidAt, m3PayrollId, syncId, paidHours, totalHours, carryForwardHours } = req.body as {
    staffProfileId:    string;
    staffName:         string;
    year:              number;
    month:             number;
    netAmountCents:    number;
    paidAt:            string;
    m3PayrollId:       string;
    syncId:            string;
    paidHours?:        number;
    totalHours?:       number;
    carryForwardHours?: number;
  };

  // Check for true duplicate (same M3 syncId already processed)
  const existingBySyncId = await Payment.findOne({ tenantId, syncId }).lean();
  const duplicate = !!existingBySyncId;

  // Upsert on the compound unique key — handles both new payments and pre-existing "Offen" records
  const payment = await Payment.findOneAndUpdate(
    { tenantId, staffProfileId, year, month },
    {
      $set: {
        staffName,
        basePay:         Math.round(netAmountCents / 100),
        totalAmount:     Math.round(netAmountCents / 100),
        status:          'paid',
        paidAt:          new Date(paidAt),
        source:          'm3',
        syncId,
        syncedAt:        new Date(),
        syncStatus:      'synced',
        m3JournalEntryId: m3PayrollId,
        notes:           'Paid via M3',
        ...(paidHours         != null && { paidHours }),
        ...(totalHours        != null && { totalHours }),
        ...(carryForwardHours != null && { carryForwardHours }),
      },
      $setOnInsert: {
        totalHoursWorked:      0,
        totalEventsWorked:     0,
        basePayFromTimesheets: 0,
        bonus:                 0,
        deductions:            0,
      },
    },
    { new: true, upsert: true }
  );

  // Mark related timesheets as synced when M3 acknowledges the payment
  const from = new Date(Number(year), Number(month) - 1, 1);
  const to   = new Date(Number(year), Number(month),     1);
  await EventTimesheet.updateMany(
    { tenantId, staffProfileId, status: 'approved', approvedAt: { $gte: from, $lt: to } },
    { $set: { syncStatus: 'synced' } }
  );

  res.status(201).json({ ok: true, paymentId: payment!._id, duplicate });
}));

export default router;
