import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';
import { AppError } from '../utils/AppError';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}
