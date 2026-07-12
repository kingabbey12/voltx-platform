import { createHash, randomBytes } from 'node:crypto';

/**
 * Same hash-and-compare convention used by RefreshToken
 * (`src/modules/auth/utils/refresh-token.util.ts`): sha256 hex digest,
 * stored instead of the raw secret, compared by re-hashing the incoming
 * value. Reused here (rather than re-implemented) for MFA backup codes and
 * API keys — both are bearer secrets shown once and never stored/retrieved
 * in plaintext, exactly like a refresh token.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Human-friendly one-time backup code, e.g. "7F3K-9QZC". Uses Crockford-ish
 * unambiguous characters (no 0/O/1/I) to reduce transcription errors when a
 * user reads one off a saved list. */
export function generateBackupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateBackupCode());
}

/** Opaque, high-entropy API key body (before prefixing) — 32 random bytes,
 * base64url-encoded, matching RefreshToken's own entropy budget. */
export function generateApiKeySecret(): string {
  return randomBytes(32).toString('base64url');
}
