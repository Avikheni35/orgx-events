import apiClient from './client';

export interface EventInvoice {
  _id: string; tenantId: string; invoiceNumber: string;
  clientId: string; clientName: string; eventId?: string; eventName?: string;
  agencyName: string; invoiceDate: string; dueDate: string;
  lineItems: { description: string; hours: number; ratePerHour: number; amount: number }[];
  subtotal: number; vatRate: number; vatAmount: number; total: number;
  notes?: string; status: 'draft' | 'sent' | 'paid' | 'cancelled';
  syncStatus?: 'not_configured' | 'pending' | 'synced' | 'failed';
  syncId?: string; m3InvoiceId?: string;
  createdAt: string; updatedAt: string;
}

const BASE = '/invoices';
export const invoicesApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ invoices: EventInvoice[]; total: number; pages: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<EventInvoice>(`${BASE}/${id}`),
  create: (data: { clientId: string; eventId?: string; timesheetIds: string[]; invoiceDate: string; dueDate: string; vatRate?: number; notes?: string }) =>
    apiClient.post<EventInvoice>(BASE, data),
  setStatus: (id: string, status: string) => apiClient.patch<EventInvoice>(`${BASE}/${id}/status`, { status }),
};
