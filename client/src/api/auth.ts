import apiClient from './client';
import type { AuthUser } from '../types';

export const authApi = {
  login: (email: string, password: string, tenantCode?: string) =>
    apiClient.post<{ accessToken: string; user: AuthUser } | { requiresOtp: boolean }>('/auth/login', { email, password, tenantCode }),

  verifyOtp: (email: string, otp: string, tenantCode?: string) =>
    apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/verify-otp', { email, otp, tenantCode }),

  magicLink: (email: string, tenantCode: string) =>
    apiClient.post<{ message: string }>('/auth/magic-link', { email, tenantCode }),

  magicLogin: (token: string) =>
    apiClient.post<{ accessToken: string; user: AuthUser }>(`/auth/magic-login/${token}`),

  me: () =>
    apiClient.get<AuthUser>('/auth/me').then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout'),

  refresh: () =>
    apiClient.post<{ accessToken: string }>('/auth/refresh'),
};
