import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { EventInvoice } from '../models/EventInvoice';
import { EventTimesheet } from '../models/EventTimesheet';
import { EventClient } from '../models/EventClient';
import { Tenant } from '../models/Tenant';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { peers } from '../utils/serviceClient';
import { enqueueOutbox } from '../utils/outbox';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'coordinator'));

const createSchema = z.object({
  clientId: z.string().min(1),
  eventId: z.string().optional(),
  timesheetIds: z.array(z.string()).min(1),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  vatRate: z.number().min(0).max(100).default(19),
  notes: z.string().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, clientId, page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { tenantId };
  if (status) query.status = status;
  if (clientId) query.clientId = clientId;
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [invoices, total] = await Promise.all([
    EventInvoice.find(query).sort({ invoiceDate: -1 }).skip((p - 1) * l).limit(l).lean(),
    EventInvoice.countDocuments(query),
  ]);
  res.json({ invoices, total, page: p, pages: Math.ceil(total / l) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await EventInvoice.findOne({ _id: req.params.id, tenantId: req.user!.tenantId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  res.json(invoice);
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId!;
  const { clientId, eventId, timesheetIds, invoiceDate, dueDate, vatRate, notes } = req.body as z.infer<typeof createSchema>;

  const timesheets = await EventTimesheet.find({ _id: { $in: timesheetIds }, tenantId, clientId, status: 'approved' });
  if (timesheets.length !== timesheetIds.length) throw new AppError('One or more timesheets are invalid or not approved', 400);

  const [client, tenant] = await Promise.all([
    EventClient.findOne({ _id: clientId, tenantId }).lean(),
    Tenant.findById(tenantId).lean(),
  ]);
  if (!client) throw new AppError('Event client not found', 404);
  if (!tenant) throw new AppError('Tenant not found', 404);

  const count = await EventInvoice.countDocuments({ tenantId });
  const invoiceNumber = `EINV-${String(count + 1).padStart(5, '0')}`;

  const lineItems = timesheets.map((ts) => {
    const rate = ts.billingRatePerHour ?? ts.payRatePerHour;
    return {
      timesheetId: ts._id,
      description: `${ts.staffName} – ${ts.positionTitle}`,
      hours: ts.totalHours,
      ratePerHour: rate,
      amount: parseFloat((ts.totalHours * rate).toFixed(2)),
    };
  });

  const subtotal = parseFloat(lineItems.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const vatAmount = parseFloat((subtotal * vatRate / 100).toFixed(2));
  const total = parseFloat((subtotal + vatAmount).toFixed(2));

  const invoice = await EventInvoice.create({
    tenantId,
    invoiceNumber,
    clientId: new Types.ObjectId(clientId),
    clientName: client.name,
    eventId: eventId ? new Types.ObjectId(eventId) : undefined,
    agencyName: tenant.name,
    invoiceDate,
    dueDate,
    lineItems,
    subtotal,
    vatRate,
    vatAmount,
    total,
    notes,
    createdBy: req.user!.userId,
  });

  res.status(201).json(invoice);
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body as { status: string };
  const invoice = await EventInvoice.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user!.tenantId },
    { status },
    { new: true }
  );
  if (!invoice) throw new AppError('Invoice not found', 404);

  const tenantId = invoice.tenantId.toString();
  const amountCents = Math.round(invoice.total * 100);
  const postingDate = new Date().toISOString().split('T')[0];

  if (status === 'sent') {
    const syncId = `m2_inv_${invoice._id}`;
    await EventInvoice.updateOne({ _id: invoice._id }, { syncStatus: 'pending', syncId });

    const lineItems = invoice.lineItems.map((li) => ({
      description:    li.description,
      quantity:       li.hours,
      unitPriceCents: Math.round(li.ratePerHour * 100),
      vatRate:        invoice.vatRate,
    }));

    peers.m3.pushInvoice(tenantId, {
      syncId,
      m2InvoiceId:   invoice._id.toString(),
      m2ClientId:    invoice.clientId.toString(),
      clientName:    invoice.clientName,
      clientAddress: invoice.clientAddress ? { street: invoice.clientAddress } : undefined,
      clientVatId:   invoice.clientVatId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate:   invoice.invoiceDate.toISOString().split('T')[0],
      dueDate:       invoice.dueDate.toISOString().split('T')[0],
      lineItems,
      subtotalCents: Math.round(invoice.subtotal * 100),
      vatRate:       invoice.vatRate,
      vatCents:      Math.round(invoice.vatAmount * 100),
      totalCents:    amountCents,
      notes:         invoice.notes,
    }).then(async (result) => {
      if (result) {
        await EventInvoice.updateOne({ _id: invoice._id }, { syncStatus: 'synced', syncedAt: new Date(), m3InvoiceId: result.id });
      } else {
        await EventInvoice.updateOne({ _id: invoice._id }, { syncStatus: 'failed', syncError: 'M3 unreachable or integration disabled' });
      }
    }).catch(async () => {
      await EventInvoice.updateOne({ _id: invoice._id }, { syncStatus: 'failed', syncError: 'Unexpected push error' });
    });
  } else if (status === 'paid') {
    const syncId = `m2_pay_${invoice._id}`;
    const payload = {
      debitAccount: 1200, creditAccount: 1400,
      amountCents,
      description: `Payment received – Event Invoice ${invoice.invoiceNumber}`,
      postingDate,
      sourceRef: { module: 'm2', type: 'M2Payment', id: invoice._id.toString() },
      syncId,
      sourceSnapshot: { m2RefId: invoice._id.toString(), description: `Invoice ${invoice.invoiceNumber}`, source: 'm2' as const },
    };
    const delivered = await peers.m3.postJournalEntry(tenantId, payload);
    if (!delivered) {
      await enqueueOutbox({
        tenantId, type: 'event_invoice.paid', targetModule: 'm3',
        targetPath: '/api/internal/journal-entries', payload,
      });
    }
  }

  res.json(invoice);
}));

export default router;
