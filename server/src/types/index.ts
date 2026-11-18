export type M2UserRole =
  | 'super_admin'
  | 'coordinator'
  | 'event_staff'
  | 'event_client';

export interface JwtAccessPayload {
  userId: string;
  tenantId: string | null;
  role: M2UserRole;
}

export interface JwtRefreshPayload {
  userId: string;
  tokenFamily: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
      tenantId?: string;
    }
  }
}
