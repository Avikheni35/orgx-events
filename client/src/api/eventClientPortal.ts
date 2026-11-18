import apiClient from './client';
import type { Event } from './events';

const BASE = '/event-client-portal';

export interface PortalClient {
  _id: string; tenantId: string; name: string; type: 'company' | 'individual';
  industry?: string; vatId?: string;
  address: { street?: string; city?: string; postalCode?: string; country?: string };
  contacts: { _id: string; name: string; email: string; phone?: string; jobTitle?: string; isPrimary: boolean }[];
  notes?: string; status: 'active' | 'inactive'; createdAt: string;
  paymentTermsDays?: number;
}

export interface PortalInvoice {
  _id: string; invoiceNumber: string; clientId: string; clientName: string;
  eventId?: string; eventName?: string; agencyName: string;
  invoiceDate: string; dueDate: string;
  lineItems: { description: string; hours: number; ratePerHour: number; amount: number }[];
  subtotal: number; vatRate: number; vatAmount: number; total: number;
  notes?: string; status: 'draft' | 'sent' | 'paid' | 'cancelled'; createdAt: string;
}

export interface PortalStaffMember {
  _id: string;
  staffName: string;
  positionTitle: string;
  slotStart: string;
  slotEnd: string;
  status: string;
}

export const eventClientPortalApi = {
  me: () => apiClient.get<PortalClient>(`${BASE}/me`),
  listEvents: (params?: Record<string, string>) =>
    apiClient.get<{ events: Event[]; total: number; pages: number }>(`${BASE}/events`, { params }),
  getEvent: (id: string) => apiClient.get<Event>(`${BASE}/events/${id}`),
  getEventStaff: (id: string) =>
    apiClient.get<{ staff: PortalStaffMember[] }>(`${BASE}/events/${id}/staff`),
  approveEvent: (id: string) => apiClient.post<Event>(`${BASE}/events/${id}/approve`),
  listInvoices: (params?: Record<string, string>) =>
    apiClient.get<{ invoices: PortalInvoice[]; total: number; pages: number }>(`${BASE}/invoices`, { params }),
  getInvoice: (id: string) => apiClient.get<PortalInvoice>(`${BASE}/invoices/${id}`),
  downloadInvoicePdf: (id: string) =>
    apiClient.get(`${BASE}/invoices/${id}/pdf`, { responseType: 'blob' }),
};
