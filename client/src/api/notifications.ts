import apiClient from './client';

export interface Notification {
  _id: string;
  tenantId: string;
  recipientId: string;
  type: 'assignment_confirmed' | 'assignment_declined' | 'timesheet_approved' | 'payment_paid' | 'general';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const BASE = '/notifications';

export const notificationsApi = {
  list:        ()         => apiClient.get<{ notifications: Notification[] }>(BASE),
  unreadCount: ()         => apiClient.get<{ count: number }>(`${BASE}/unread-count`),
  markRead:    (id: string) => apiClient.post<{ ok: boolean }>(`${BASE}/${id}/read`, {}),
  markAllRead: ()         => apiClient.post<{ updated: number }>(`${BASE}/read-all`, {}),
};
