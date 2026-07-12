import { createHash, randomBytes } from 'node:crypto';

const SCIM_TOKEN_BYTE_LENGTH = 32;

export function generateScimToken(): string {
  return randomBytes(SCIM_TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashScimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
