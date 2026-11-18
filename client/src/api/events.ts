import apiClient from './client';

export interface EventTimeSlot { _id: string; startTime: string; endTime: string; breakMinutes: number; notes?: string; }
export interface EventPosition {
  _id: string; title: string; roleType?: string; headcount: number; skills: string[];
  payRatePerHour: number; billingRatePerHour?: number; dresscode?: string; notes?: string; slots: EventTimeSlot[];
}
export interface EventNote { _id: string; text: string; createdBy: string; createdByName: string; createdAt: string; }
export type EventStatus = 'draft' | 'planning' | 'staffing' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Event {
  _id: string; tenantId: string; name: string; eventNumber: string;
  clientId: string; clientName: string; venueId?: string; venueName?: string;
  type: string; startDate: string; endDate: string; description?: string;
  budget?: number; plannedRevenue?: number; status: EventStatus;
  positions: EventPosition[]; notes: EventNote[];
  requiresClientApproval: boolean;
  clientApprovedAt?: string;
  completedAt?: string; cancelledAt?: string;
  reportEmailedAt?: string;
  createdAt: string; updatedAt: string;
}

const BASE = '/events';
export const eventsApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ events: Event[]; total: number; pages: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<Event>(`${BASE}/${id}`),
  create: (data: Partial<Event> & { positions?: Partial<EventPosition>[] }) => apiClient.post<Event>(BASE, data),
  update: (id: string, data: Partial<Event>) => apiClient.patch<Event>(`${BASE}/${id}`, data),
  setStatus: (id: string, status: EventStatus) => apiClient.post<Event>(`${BASE}/${id}/status`, { status }),
  addPosition: (id: string, position: Partial<EventPosition>) => apiClient.post<Event>(`${BASE}/${id}/positions`, position),
  updatePosition: (id: string, positionId: string, data: Partial<EventPosition>) => apiClient.patch<Event>(`${BASE}/${id}/positions/${positionId}`, data),
  deletePosition: (id: string, positionId: string) => apiClient.delete<Event>(`${BASE}/${id}/positions/${positionId}`),
  addNote: (id: string, text: string, createdByName: string) => apiClient.post<Event>(`${BASE}/${id}/notes`, { text, createdByName }),
  downloadReport: (id: string) => apiClient.get<Blob>(`${BASE}/${id}/report`, { responseType: 'blob' }),
  emailReport: (id: string) => apiClient.post<{ message: string; reportEmailedAt: string }>(`${BASE}/${id}/report/email`),
};
