import apiClient from './client';

export interface ServiceConnectionInfo {
  url: string;
  token: string; // masked on GET
  enabled: boolean;
  lastPingAt?: string;
  lastPingOk?: boolean;
}

export interface IntegrationSettingsData {
  ownServiceToken: string;
  connectedServices: {
    m3: ServiceConnectionInfo | null;
  };
}

export const integrationsApi = {
  get: () => apiClient.get<IntegrationSettingsData>('/settings/integrations'),

  saveConnection: (data: { module: 'm3'; url: string; token: string; enabled: boolean }) =>
    apiClient.put('/settings/integrations/connections', data),

  testConnection: (mod: 'm3') =>
    apiClient.post<{ ok: boolean; latencyMs?: number }>(`/settings/integrations/test/${mod}`),

  regenerateToken: () =>
    apiClient.post<{ ownServiceToken: string }>('/settings/integrations/regenerate-token'),

  syncNow: () =>
    apiClient.post<{ timesheets: { ok: number; failed: number }; invoices: { ok: number; failed: number } }>(
      '/settings/integrations/sync-now'
    ),
};
