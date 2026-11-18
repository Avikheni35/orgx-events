import apiClient from './client';

export interface StaffProfile {
  _id: string; tenantId: string; firstName: string; lastName: string; email: string; phone?: string;
  skills: string[]; certifications: { _id: string; name: string; issuer?: string; issuedDate?: string; expiryDate?: string }[];
  rating: { average: number; count: number }; totalEventsWorked: number; totalHoursWorked: number;
  status: 'active' | 'inactive'; directAssignable: boolean; notes?: string; poolIds: string[];
  userId?: string;
  createdAt: string; updatedAt: string;
}

const BASE = '/staff-profiles';
export const staffProfilesApi = {
  list: (params?: Record<string, string>) => apiClient.get<{ profiles: StaffProfile[]; total: number; pages: number }>(BASE, { params }),
  get: (id: string) => apiClient.get<StaffProfile>(`${BASE}/${id}`),
  create: (data: Partial<StaffProfile>) => apiClient.post<StaffProfile>(BASE, data),
  update: (id: string, data: Partial<StaffProfile>) => apiClient.patch<StaffProfile>(`${BASE}/${id}`, data),
  addCertification: (id: string, cert: object) => apiClient.post<StaffProfile>(`${BASE}/${id}/certifications`, cert),
  removeCertification: (id: string, certId: string) => apiClient.delete<StaffProfile>(`${BASE}/${id}/certifications/${certId}`),
  createAccount: (id: string) => apiClient.post<{ email: string; temporaryPassword: string }>(`${BASE}/${id}/create-account`, {}),
  resetPassword: (id: string) => apiClient.post<{ email: string; temporaryPassword: string }>(`${BASE}/${id}/create-account`, {}),
};
