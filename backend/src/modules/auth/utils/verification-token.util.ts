import { createHash, randomBytes } from 'node:crypto';
import {
  EMAIL_VERIFICATION_EXPIRES_IN_HOURS,
  PASSWORD_RESET_EXPIRES_IN_HOURS,
  VERIFICATION_TOKEN_BYTE_LENGTH,
} from '../constants/auth.constants';

export function generateVerificationToken(): string {
  return randomBytes(VERIFICATION_TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getEmailVerificationExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRES_IN_HOURS);
  return expiresAt;
}

export function getPasswordResetExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRES_IN_HOURS);
  return expiresAt;
}
