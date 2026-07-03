import { createHash, randomBytes } from 'node:crypto';
import {
  REFRESH_TOKEN_BYTE_LENGTH,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from '../constants/auth.constants';

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiresAt;
}
