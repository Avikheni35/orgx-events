import { IntegrationSettings } from '../models/IntegrationSettings';

async function callM3<T = boolean>(tenantId: string, path: string, body: object): Promise<T | null> {
  const settings = await IntegrationSettings
    .findOne({ tenantId })
    .select('connectedServices.m3')
    .lean();
  const peer = settings?.connectedServices?.m3;
  if (!peer?.enabled || !peer.url || !peer.token) return null;
  try {
    const res = await fetch(`${peer.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-service-token': peer.token,
        'x-caller-module': 'm2',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function pingPeer(tenantId: string, target: 'm3'): Promise<boolean> {
  const settings = await IntegrationSettings
    .findOne({ tenantId })
    .select(`connectedServices.${target}`)
    .lean();
  const peer = settings?.connectedServices?.[target];
  if (!peer?.enabled || !peer.url || !peer.token) return false;
  try {
    const res = await fetch(`${peer.url}/api/internal/health`, {
      method: 'GET',
      headers: { 'x-service-token': peer.token, 'x-caller-module': 'm2' },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const peers = {
  m3: {
    ping: (tenantId: string) => pingPeer(tenantId, 'm3'),

    postJournalEntry: (tenantId: string, data: object) =>
      callM3<{ id: string; duplicate?: boolean }>(tenantId, '/api/internal/journal-entries', data),

    pushPayrollEntry: (tenantId: string, data: {
      syncId:        string;
      m2StaffId:     string;
      staffName:     string;
      firstName:     string;
      lastName:      string;
      email:         string;
      grossCents:    number;
      taxCents:      number;
      deductionCents: number;
      netCents:      number;
      hoursWorked:   number;
      periodYear:    number;
      periodMonth:   number;
      timesheetId:   string;
    }) => callM3<{ payrollId: string; created: boolean; duplicate?: boolean }>(tenantId, '/api/internal/payroll-lines', data),

    pushInvoice: (tenantId: string, data: {
      syncId:         string;
      m2InvoiceId:    string;
      m2ClientId:     string;
      clientName:     string;
      clientEmail?:   string;
      clientAddress?: { street?: string; city?: string; zip?: string };
      clientVatId?:   string;
      invoiceNumber:  string;
      invoiceDate:    string;
      dueDate:        string;
      lineItems:      { description: string; quantity: number; unitPriceCents: number; vatRate: number }[];
      subtotalCents:  number;
      vatRate:        number;
      vatCents:       number;
      totalCents:     number;
      notes?:         string;
    }) => callM3<{ id: string; created: boolean; duplicate?: boolean }>(tenantId, '/api/internal/sales-invoices', data),
  },
};
