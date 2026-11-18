export type M2UserRole =
  | 'super_admin'
  | 'coordinator'
  | 'event_staff'
  | 'event_client'
  | 'agency_admin'   // M1 staff roles — treated as coordinator in M2
  | 'disponent';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: M2UserRole;
  tenantId: string | null;
  language: 'de' | 'en';
}

export type PortalPath =
  | '/coordinator/dashboard'
  | '/event-staff/home'
  | '/event-client/dashboard';

export function portalHome(role: M2UserRole): PortalPath {
  switch (role) {
    case 'super_admin':
    case 'coordinator':
    case 'agency_admin':  // M1 agency admins get coordinator access in M2
    case 'disponent':     return '/coordinator/dashboard';
    case 'event_staff':   return '/event-staff/home';
    case 'event_client':  return '/event-client/dashboard';
    default:              return '/coordinator/dashboard';
  }
}
