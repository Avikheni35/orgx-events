import { Router } from 'express';
import { Types } from 'mongoose';
import { EventClient } from '../models/EventClient';
import { Event } from '../models/Event';
import { EventInvoice } from '../models/EventInvoice';
import { EventStaffAssignment } from '../models/EventStaffAssignment';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import puppeteer from 'puppeteer';

const router = Router();
router.use(requireAuth);
router.use(requireRole('event_client'));

async function getClient(userId: string, tenantId: string | null) {
  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (tenantId) query.tenantId = new Types.ObjectId(tenantId);
  const client = await EventClient.findOne(query).lean();
  if (!client) throw new AppError('No event client profile linked to this account', 404);
  return client;
}

// GET /me — return EventClient record for logged-in user
router.get('/me', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  res.json(client);
}));

// GET /events
router.get('/events', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { clientId: client._id };
  if (status) query.status = status;
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [events, total] = await Promise.all([
    Event.find(query).sort({ startDate: -1 }).skip((p - 1) * l).limit(l).lean(),
    Event.countDocuments(query),
  ]);
  res.json({ events, total, page: p, pages: Math.ceil(total / l) });
}));

// GET /events/:id
router.get('/events/:id', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const event = await Event.findOne({ _id: req.params.id, clientId: client._id }).lean();
  if (!event) throw new AppError('Event not found', 404);
  res.json(event);
}));

// GET /events/:id/staff — staff roster without pay rates
router.get('/events/:id/staff', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const event = await Event.findOne({ _id: req.params.id, clientId: client._id }).lean();
  if (!event) throw new AppError('Event not found', 404);

  const assignments = await EventStaffAssignment.find({
    eventId: event._id,
    status: { $in: ['confirmed', 'worked'] },
  })
    .select('staffName positionTitle slotStart slotEnd status')
    .sort({ slotStart: 1 })
    .lean();

  res.json({ staff: assignments });
}));

// POST /events/:id/approve — client approves event (planning → confirmed)
router.post('/events/:id/approve', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const event = await Event.findOne({ _id: req.params.id, clientId: client._id });
  if (!event) throw new AppError('Event not found', 404);
  if (!event.requiresClientApproval) throw new AppError('This event does not require client approval', 400);
  if (event.status !== 'planning') throw new AppError('Only events in planning status can be approved', 400);

  event.status = 'confirmed';
  event.clientApprovedAt = new Date();
  await event.save();
  res.json(event);
}));

// GET /invoices
router.get('/invoices', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const query: Record<string, unknown> = { clientId: client._id };
  if (status) query.status = status;
  const p = Math.max(1, parseInt(page)), l = Math.min(100, parseInt(limit));
  const [invoices, total] = await Promise.all([
    EventInvoice.find(query).sort({ invoiceDate: -1 }).skip((p - 1) * l).limit(l).lean(),
    EventInvoice.countDocuments(query),
  ]);
  res.json({ invoices, total, page: p, pages: Math.ceil(total / l) });
}));

// GET /invoices/:id
router.get('/invoices/:id', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const invoice = await EventInvoice.findOne({ _id: req.params.id, clientId: client._id }).lean();
  if (!invoice) throw new AppError('Invoice not found', 404);
  res.json(invoice);
}));

// GET /invoices/:id/pdf
router.get('/invoices/:id/pdf', asyncHandler(async (req, res) => {
  const client = await getClient(req.user!.userId, req.user!.tenantId);
  const invoice = await EventInvoice.findOne({ _id: req.params.id, clientId: client._id }).lean();
  if (!invoice) throw new AppError('Invoice not found', 404);

  const fmtDate = (d: Date) => new Date(d).toLocaleDateString('de-DE');
  const fmtEur = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#333}
h1{font-size:22px;margin-bottom:4px}
.meta{color:#666;font-size:13px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:13px;border-bottom:2px solid #ddd}
td{padding:8px 10px;font-size:13px;border-bottom:1px solid #eee}
.right{text-align:right}
.totals{margin-left:auto;width:280px}
.totals td{border:none;padding:4px 10px}
.total-row{font-weight:700;font-size:15px;border-top:2px solid #333!important}
</style></head><body>
<h1>Rechnung ${invoice.invoiceNumber}</h1>
<div class="meta">
  <strong>${invoice.agencyName}</strong><br/>
  ${invoice.agencyAddress ?? ''}<br/><br/>
  An: <strong>${invoice.clientName}</strong><br/>
  Rechnungsdatum: ${fmtDate(invoice.invoiceDate)}<br/>
  Fälligkeitsdatum: ${fmtDate(invoice.dueDate)}
</div>
<table>
<thead><tr><th>Beschreibung</th><th class="right">Stunden</th><th class="right">Rate</th><th class="right">Betrag</th></tr></thead>
<tbody>
${invoice.lineItems.map(li => `<tr>
  <td>${li.description}</td>
  <td class="right">${li.hours.toFixed(2)}</td>
  <td class="right">${fmtEur(li.ratePerHour)}</td>
  <td class="right">${fmtEur(li.amount)}</td>
</tr>`).join('')}
</tbody></table>
<table class="totals"><tbody>
<tr><td>Nettobetrag</td><td class="right">${fmtEur(invoice.subtotal)}</td></tr>
<tr><td>MwSt. (${invoice.vatRate}%)</td><td class="right">${fmtEur(invoice.vatAmount)}</td></tr>
<tr class="total-row"><td>Gesamtbetrag</td><td class="right">${fmtEur(invoice.total)}</td></tr>
</tbody></table>
${invoice.notes ? `<p style="margin-top:24px;font-size:13px;color:#666">${invoice.notes}</p>` : ''}
</body></html>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Rechnung-${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}));

export default router;
