import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtAccessPayload, JwtRefreshPayload } from '../types';

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES as never });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES as never });
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}

export function signSpecialToken(payload: object, expiresIn: string): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: expiresIn as never });
}

export function verifySpecialToken(token: string): Record<string, unknown> {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as Record<string, unknown>;
}
