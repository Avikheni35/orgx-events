import apiClient from './client';

export interface ManagedUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'coordinator' | 'event_staff' | 'event_client';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLoginAt?: string;
}

export interface InviteUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  role: 'event_staff' | 'event_client' | 'coordinator';
}

const BASE = '/users';
export const userManagementApi = {
  list: (role?: string) => apiClient.get<ManagedUser[]>(BASE, { params: role ? { role } : undefined }),
  invite: (data: InviteUserPayload) => apiClient.post<ManagedUser>(BASE, data),
  setStatus: (id: string, status: 'active' | 'inactive') => apiClient.patch<{ message: string; status: string }>(`${BASE}/${id}/status`, { status }),
  delete: (id: string) => apiClient.delete<{ message: string }>(`${BASE}/${id}`),
  resendInvite: (id: string) => apiClient.post<{ message: string }>(`${BASE}/${id}/resend-invite`),
};
