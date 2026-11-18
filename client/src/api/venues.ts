import apiClient from './client';

export interface Venue {
  _id: string; tenantId: string; name: string; type: 'indoor' | 'outdoor' | 'hybrid';
  capacity?: number; address?: { street?: string; city?: string; postalCode?: string; country?: string };
  facilities: string[]; notes?: string; status: 'active' | 'inactive'; createdAt: string; updatedAt: string;
}

const BASE = '/venues';
export const venuesApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ venues: Venue[]; total: number; pages: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<Venue>(`${BASE}/${id}`),
  create: (data: Partial<Venue>) => apiClient.post<Venue>(BASE, data),
  update: (id: string, data: Partial<Venue>) => apiClient.patch<Venue>(`${BASE}/${id}`, data),
  delete: (id: string) => apiClient.delete(`${BASE}/${id}`),
  listEvents: (venueId: string, params?: Record<string, string>) =>
    apiClient.get<{ events: unknown[]; total: number }>(`/events`, { params: { ...params, venueId } }),
};
