import apiClient from './client';

export type ApplicationStatus = 'pending' | 'withdrawn';

export interface EventApplication {
  _id: string;
  tenantId: string;
  eventId: string;
  eventName: string;
  staffProfileId: string;
  staffName: string;
  staffEmail: string;
  note?: string;
  status: ApplicationStatus;
  appliedAt: string;
  createdAt: string;
}

const BASE = '/event-applications';
export const eventApplicationsApi = {
  listByEvent: (eventId: string) =>
    apiClient.get<EventApplication[]>(`${BASE}/event/${eventId}`),
  availableEvents: () =>
    apiClient.get(`${BASE}/available-events`),
  mine: () =>
    apiClient.get<EventApplication[]>(`${BASE}/mine`),
  apply: (eventId: string, note?: string) =>
    apiClient.post<EventApplication>(BASE, { eventId, note }),
  withdraw: (id: string) =>
    apiClient.delete(`${BASE}/${id}`),
};
