import { authenticator } from 'otplib';

// Accept the previous/next 30s time-step in addition to the current one,
// absorbing ordinary clock drift between server and phone without
// materially widening the guessable window.
authenticator.options = { window: 1 };

/** 6-digit numeric TOTP codes are distinguished from backup codes (which
 * always contain a '-') purely by shape — see mfa.service.ts's `isTotpCode`. */
const TOTP_CODE_PATTERN = /^\d{6}$/;

export function isTotpCodeShape(code: string): boolean {
  return TOTP_CODE_PATTERN.test(code);
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateTotpUri(issuer: string, accountLabel: string, secret: string): string {
  return authenticator.keyuri(accountLabel, issuer, secret);
}

export function generateTotpCode(secret: string): Promise<string> {
  return Promise.resolve(authenticator.generate(secret));
}

export function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  return Promise.resolve(authenticator.check(code, secret));
}
