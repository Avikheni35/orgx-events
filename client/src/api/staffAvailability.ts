import apiClient from './client';

export interface WeeklySlot {
  dayOfWeek: number; // 0=Sun … 6=Sat
  available: boolean;
  startTime?: string;
  endTime?: string;
}

export interface DateOverride {
  _id?: string;
  date: string;
  available: boolean;
  startTime?: string;
  endTime?: string;
  note?: string;
}

export interface StaffAvailability {
  _id: string;
  staffProfileId: string;
  weeklyPattern: WeeklySlot[];
  dateOverrides: DateOverride[];
  updatedAt: string;
}

export interface StaffAvailabilityOverviewEntry {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl?: string;
  availability: StaffAvailability | null;
  assignments: {
    eventName: string;
    slotStart: string;
    slotEnd: string;
    status: string;
  }[];
}

export interface StaffAvailabilityOverview {
  staff: StaffAvailabilityOverviewEntry[];
}

const BASE = '/staff-availability';
export const staffAvailabilityApi = {
  getMine: () => apiClient.get<StaffAvailability>(`${BASE}/mine`),
  updateWeekly: (weeklyPattern: WeeklySlot[]) =>
    apiClient.put<StaffAvailability>(`${BASE}/mine/weekly`, { weeklyPattern }),
  upsertOverride: (override: Omit<DateOverride, '_id'>) =>
    apiClient.put<StaffAvailability>(`${BASE}/mine/override`, override),
  deleteOverride: (overrideId: string) =>
    apiClient.delete(`${BASE}/mine/override/${overrideId}`),
  getForStaff: (staffProfileId: string) =>
    apiClient.get<StaffAvailability | null>(`${BASE}/staff/${staffProfileId}`),
  getOverview: (start: string, end: string) =>
    apiClient.get<StaffAvailabilityOverview>(`${BASE}/overview`, { params: { start, end } }),
};
