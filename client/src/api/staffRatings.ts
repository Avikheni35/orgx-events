import apiClient from './client';

export interface StaffRating {
  _id: string;
  staffProfileId: string;
  eventId: string;
  eventName: string;
  coordinatorId: string;
  coordinatorName: string;
  score: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

const BASE = '/staff-ratings';
export const staffRatingsApi = {
  create: (data: { staffProfileId: string; eventId: string; score: number; comment?: string }) =>
    apiClient.post<StaffRating>(BASE, data),
  forStaff: (staffProfileId: string) =>
    apiClient.get<{ ratings: StaffRating[] }>(`${BASE}/staff/${staffProfileId}`),
  forEvent: (eventId: string) =>
    apiClient.get<{ ratings: StaffRating[] }>(`${BASE}/event/${eventId}`),
};
