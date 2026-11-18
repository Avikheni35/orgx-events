import apiClient from './client';

export interface StaffPool {
  _id: string; tenantId: string; name: string; description?: string;
  memberCount: number; status: 'active' | 'inactive'; createdAt: string; updatedAt: string;
}

const BASE = '/staff-pools';
export const staffPoolsApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ pools: StaffPool[]; total: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<StaffPool & { memberIds: string[] }>(`${BASE}/${id}`),
  create: (data: { name: string; description?: string }) => apiClient.post<StaffPool>(BASE, data),
  update: (id: string, data: Partial<StaffPool>) => apiClient.patch<StaffPool>(`${BASE}/${id}`, data),
  addMember: (id: string, staffProfileId: string) => apiClient.post(`${BASE}/${id}/members`, { staffProfileId }),
  removeMember: (id: string, staffProfileId: string) => apiClient.delete(`${BASE}/${id}/members/${staffProfileId}`),
};
