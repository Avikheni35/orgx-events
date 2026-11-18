import apiClient from './client';

export interface Payment {
  _id: string;
  tenantId: string;
  staffProfileId: string;
  staffName: string;

  year: number;
  month: number;

  totalHoursWorked: number;
  totalEventsWorked: number;
  basePayFromTimesheets: number;

  basePay: number;
  bonus: number;
  deductions: number;
  totalAmount: number;

  status: 'pending' | 'paid';
  paidAt?: string;
  notes?: string;
  paidHours?: number;
  totalHours?: number;
  carryForwardHours?: number;

  createdAt: string;
  updatedAt: string;
}

const BASE = '/payments';

export const paymentsApi = {
  list: (params?: { year?: number; month?: number; status?: string; staffProfileId?: string }) =>
    apiClient.get<{ payments: Payment[]; total: number }>(BASE, { params }),

  generate: (year: number, month: number) =>
    apiClient.post<{ generated: number; payments: Payment[]; message?: string }>(`${BASE}/generate`, { year, month }),

  forStaff: (staffProfileId: string) =>
    apiClient.get<{ payments: Payment[] }>(`${BASE}/staff/${staffProfileId}`),

  update: (id: string, data: { basePay?: number; bonus?: number; deductions?: number; notes?: string }) =>
    apiClient.patch<Payment>(`${BASE}/${id}`, data),

  markPaid: (id: string) =>
    apiClient.post<Payment>(`${BASE}/${id}/pay`, {}),

  revert: (id: string) =>
    apiClient.post<Payment>(`${BASE}/${id}/revert`, {}),
};
