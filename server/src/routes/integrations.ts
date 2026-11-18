import { Router } from 'express';
import { randomBytes } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { IntegrationSettings } from '../models/IntegrationSettings';
import { peers } from '../utils/serviceClient';
import { EventTimesheet } from '../models/EventTimesheet';
import { EventInvoice } from '../models/EventInvoice';
import { StaffProfile } from '../models/StaffProfile';

const router = Router();
router.use(requireAuth);
router.use(requireRole('coordinator'));

function maskToken(token: string): string {
  return '••••••••' + token.slice(-8);
}

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  let settings = await IntegrationSettings.findOne({ tenantId });
  if (!settings) {
    settings = await IntegrationSettings.create({ tenantId });
  }

  const cs = settings.connectedServices;
  res.json({
    ownServiceToken: settings.ownServiceToken,
    connectedServices: {
      m3: cs.m3 ? { url: cs.m3.url, enabled: cs.m3.enabled, lastPingAt: cs.m3.lastPingAt, lastPingOk: cs.m3.lastPingOk, token: maskToken(cs.m3.token) } : null,
    },
  });
}));

router.put('/connections', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { module: mod, url, token, enabled } = req.body as {
    module: 'm3';
    url: string;
    token: string;
    enabled: boolean;
  };

  if (mod !== 'm3') throw new AppError('Invalid module', 400);
  if (!url) throw new AppError('url is required', 400);

  let settings = await IntegrationSettings.findOne({ tenantId });
  if (!settings) settings = new IntegrationSettings({ tenantId });

  settings.connectedServices = settings.connectedServices ?? {};
  const existingToken = (settings.connectedServices as Record<string, { token?: string }>)[mod]?.token;
  const resolvedToken = token || existingToken;
  if (!resolvedToken) throw new AppError('token is required for new connections', 400);
  (settings.connectedServices as Record<string, unknown>)[mod] = { url, token: resolvedToken, enabled: enabled !== false };
  await settings.save();

  res.json({ ok: true });
}));

router.post('/test/:module', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const mod = req.params.module as 'm3';
  if (mod !== 'm3') throw new AppError('Invalid module', 400);

  const start = Date.now();
  const ok = await peers[mod].ping(tenantId);
  const latencyMs = Date.now() - start;

  // Update lastPingAt/lastPingOk
  const settings = await IntegrationSettings.findOne({ tenantId });
  if (settings?.connectedServices?.[mod]) {
    (settings.connectedServices[mod] as { lastPingAt: Date; lastPingOk: boolean }).lastPingAt = new Date();
    (settings.connectedServices[mod] as { lastPingAt: Date; lastPingOk: boolean }).lastPingOk = ok;
    await settings.save();
  }

  res.json({ ok, latencyMs });
}));

router.post('/sync-now', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const tid = tenantId.toString();

  const [timesheets, invoices] = await Promise.all([
    EventTimesheet.find({ tenantId, syncStatus: { $in: ['pending', 'failed'] } }).lean(),
    EventInvoice.find({ tenantId, syncStatus: { $in: ['pending', 'failed'] } }).lean(),
  ]);

  let tsOk = 0, tsFail = 0, invOk = 0, invFail = 0;

  await Promise.all([
    ...timesheets.map(async (ts) => {
      const sp = await StaffProfile.findById(ts.staffProfileId).lean();
      const taxRate = sp?.taxRate ?? ts.taxRate ?? 0;
      const grossCents = Math.round(ts.grossPay * 100);
      const taxCents = Math.round(grossCents * taxRate);
      const deductionsCents = sp?.deductions?.reduce((s, d) => s + d.amountCents, 0) ?? ts.deductionsCents ?? 0;
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
      const lineItems = inv.lineItems.map((li) => ({
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

router.post('/regenerate-token', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const newToken = 'sk_m2_' + randomBytes(24).toString('hex');

  let settings = await IntegrationSettings.findOne({ tenantId });
  if (!settings) settings = new IntegrationSettings({ tenantId });
  settings.ownServiceToken = newToken;
  await settings.save();

  res.json({ ownServiceToken: newToken });
}));

export default router;
