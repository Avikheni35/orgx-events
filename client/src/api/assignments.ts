import apiClient from './client';

export type AssignmentStatus = 'invited' | 'confirmed' | 'declined' | 'no_show' | 'worked' | 'cancelled';
export interface Assignment {
  _id: string; tenantId: string; eventId: string; eventName: string;
  positionId: string; positionTitle: string; slotId: string; slotStart: string; slotEnd: string;
  staffProfileId: string; staffName: string; staffEmail: string;
  payRatePerHour: number; billingRatePerHour?: number;
  status: AssignmentStatus; staffNote?: string;
  checkInTime?: string; checkOutTime?: string;
  actualStartTime?: string; actualEndTime?: string; actualBreakMinutes: number;
  createdAt: string; updatedAt: string;
}

const BASE = '/assignments';
export const assignmentsApi = {
  mine: () => apiClient.get<Assignment[]>(`${BASE}/mine`),
  getInvitation: (token: string) => apiClient.get<Assignment>(`${BASE}/invitation/${token}`),
  listByEvent: (eventId: string) => apiClient.get<Assignment[]>(`${BASE}/event/${eventId}`),
  periodConflicts: (start: string, end: string) =>
    apiClient.get<Record<string, Assignment[]>>(`${BASE}/period`, { params: { start, end } }),
  create: (data: { eventId: string; positionId: string; slotId: string; staffProfileId: string; forceInvite?: boolean }) =>
    apiClient.post<Assignment>(BASE, { ...data, tzOffset: new Date().getTimezoneOffset() }),
  setStatus: (id: string, status: AssignmentStatus) =>
    apiClient.patch<Assignment>(`${BASE}/${id}/status`, { status }),
  respond: (token: string, response: 'confirmed' | 'declined', note?: string) =>
    apiClient.post<{ message: string; assignment: Assignment }>(`${BASE}/respond/${token}`, { response, note }),
  respondById: (id: string, response: 'confirmed' | 'declined', note?: string) =>
    apiClient.patch<{ message: string; assignment: Assignment }>(`${BASE}/${id}/respond`, { response, note }),
  checkin: (id: string, location?: { lat: number; lng: number }) =>
    apiClient.post<Assignment>(`${BASE}/${id}/checkin`, location ?? {}),
  checkout: (id: string, actualBreakMinutes?: number) =>
    apiClient.post<Assignment>(`${BASE}/${id}/checkout`, { actualBreakMinutes }),
  cancel: (id: string) => apiClient.delete(`${BASE}/${id}`),
};
