import apiClient from './client';

export interface EventClientContact { _id?: string; name: string; email: string; phone?: string; jobTitle?: string; isPrimary?: boolean; }
export interface EventClient {
  _id: string; tenantId: string; name: string; type: 'company' | 'individual';
  industry?: string; vatId?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  billingAddress?: { street?: string; city?: string; postalCode?: string; country?: string };
  paymentTermsDays: number; contacts: EventClientContact[]; notes?: string; status: 'active' | 'inactive';
  createdAt: string; updatedAt: string;
}

const BASE = '/event-clients';
export const eventClientsApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ clients: EventClient[]; total: number; pages: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<EventClient>(`${BASE}/${id}`),
  create: (data: Partial<EventClient>) => apiClient.post<EventClient>(BASE, data),
  update: (id: string, data: Partial<EventClient>) => apiClient.patch<EventClient>(`${BASE}/${id}`, data),
  addContact: (id: string, contact: EventClientContact) => apiClient.post<EventClient>(`${BASE}/${id}/contacts`, contact),
  removeContact: (id: string, contactId: string) => apiClient.delete<EventClient>(`${BASE}/${id}/contacts/${contactId}`),
};
