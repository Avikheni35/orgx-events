import apiClient from './client';

export interface TemplatePosition {
  title: string;
  roleType?: string;
  headcount: number;
  skills: string[];
  payRatePerHour: number;
  billingRatePerHour?: number;
  dresscode?: string;
  notes?: string;
  durationHours: number;
  breakMinutes: number;
}

export interface EventTemplate {
  _id: string;
  tenantId: string;
  name: string;
  type: string;
  description?: string;
  requiresClientApproval: boolean;
  positions: TemplatePosition[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateTemplatePayload = Omit<EventTemplate, '_id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>;

const BASE = '/event-templates';
export const eventTemplatesApi = {
  list: () => apiClient.get<EventTemplate[]>(BASE),
  get: (id: string) => apiClient.get<EventTemplate>(`${BASE}/${id}`),
  create: (data: CreateTemplatePayload) => apiClient.post<EventTemplate>(BASE, data),
  update: (id: string, data: CreateTemplatePayload) => apiClient.put<EventTemplate>(`${BASE}/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`${BASE}/${id}`),
};
