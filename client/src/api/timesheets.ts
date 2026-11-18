import apiClient from './client';
import type { Assignment } from './assignments';

export interface EventTimesheet {
  _id: string; tenantId: string; eventId: string; eventName: string;
  assignmentId: string; staffProfileId: string; staffName: string;
  clientId: string; clientName: string; positionTitle: string;
  plannedStartTime: string; plannedEndTime: string; plannedBreakMinutes: number;
  actualStartTime?: string; actualEndTime?: string;
  breakTaken: boolean; actualBreakMinutes: number;
  totalHours: number; payRatePerHour: number; grossPay: number; billingRatePerHour?: number;
  ratingByCoordinator?: number; ratingNote?: string;
  status: 'pending' | 'approved' | 'disputed';
  approvedAt?: string; disputeReason?: string;
  taxRate?: number; deductionsCents?: number; netPay?: number;
  syncStatus?: 'not_configured' | 'pending' | 'synced' | 'failed';
  syncId?: string; m3PayrollId?: string;
  createdAt: string; updatedAt: string;
}

export interface EventTimesheetEntry {
  assignment: Assignment;
  timesheet: EventTimesheet | null;
}

export interface EventTimesheetView {
  event: { _id: string; name: string; startDate: string; endDate: string; status: string; clientName: string; venueName: string };
  entries: EventTimesheetEntry[];
}

const BASE = '/timesheets';
export const timesheetsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ timesheets: EventTimesheet[]; total: number; pages: number }>(BASE, { params }),
  getForEvent: (eventId: string) =>
    apiClient.get<EventTimesheetView>(`${BASE}/event/${eventId}`),
  generate: (eventId: string) =>
    apiClient.post<{ generated: number; timesheets: EventTimesheet[] }>(`${BASE}/event/${eventId}/generate`),
  approveAll: (eventId: string) =>
    apiClient.post<{ approved: number }>(`${BASE}/event/${eventId}/approve-all`),
  get: (id: string) => apiClient.get<EventTimesheet>(`${BASE}/${id}`),
  update: (id: string, data: {
    actualStartTime?: string; actualEndTime?: string;
    breakTaken?: boolean; actualBreakMinutes?: number;
    ratingByCoordinator?: number; ratingNote?: string;
  }) => apiClient.patch<EventTimesheet>(`${BASE}/${id}`, data),
  approve: (id: string) => apiClient.post<EventTimesheet>(`${BASE}/${id}/approve`),
  dispute: (id: string, reason: string) => apiClient.post<EventTimesheet>(`${BASE}/${id}/dispute`, { reason }),
  myList: () => apiClient.get<EventTimesheet[]>(`${BASE}/my/list`),
};
