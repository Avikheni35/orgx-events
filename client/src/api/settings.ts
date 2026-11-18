import apiClient from './client';

export interface M2FeatureFlags {
  publicApplicationFlow: boolean;
  autoAssignOnAvailability: boolean;
  autoApproveTimesheets: boolean;
  requireCheckinPhoto: boolean;
  disputeWindowDays: number;
  invoicingEnabled: boolean;
  paymentGateway: 'none' | 'stripe' | 'sepa';
  defaultEventVisibility: 'private' | 'public';
  eventClientPortal: boolean;
  staffRatingEnabled: boolean;
}

export const DEFAULT_FLAGS: M2FeatureFlags = {
  publicApplicationFlow: false,
  autoAssignOnAvailability: false,
  autoApproveTimesheets: false,
  requireCheckinPhoto: false,
  disputeWindowDays: 7,
  invoicingEnabled: true,
  paymentGateway: 'none',
  defaultEventVisibility: 'private',
  eventClientPortal: true,
  staffRatingEnabled: true,
};

export const m2SettingsApi = {
  getFeatures: () =>
    apiClient.get<M2FeatureFlags>('/settings/features').then((r) => r.data),
  updateFeatures: (data: Partial<M2FeatureFlags>) =>
    apiClient.patch<M2FeatureFlags>('/settings/features', data).then((r) => r.data),
};
