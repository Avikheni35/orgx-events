import { Request, Response, NextFunction } from 'express';
import type { M2UserRole } from '../types';
import { AppError } from '../utils/AppError';

// M1 staff roles that get coordinator-level access in M2
const COORDINATOR_EQUIV = new Set(['agency_admin', 'disponent']);

export function requireRole(...roles: M2UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const userRole = req.user.role as M2UserRole;
    // agency_admin / disponent from M1 are treated as coordinator in M2
    const effectiveRole = COORDINATOR_EQUIV.has(userRole) ? 'coordinator' : userRole;
    if (!roles.includes(effectiveRole)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}

export function requireSameTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new AppError('Authentication required', 401);
  if (req.user.role === 'super_admin' || COORDINATOR_EQUIV.has(req.user.role)) { next(); return; }
  if (!req.tenantId) throw new AppError('Tenant context missing', 400);
  if (req.user.tenantId !== req.tenantId) throw new AppError('Tenant mismatch', 403);
  next();
}
