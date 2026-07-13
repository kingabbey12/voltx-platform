import { createHash } from 'node:crypto';
import { EncryptionService } from '../../integrations/security/encryption.service';

/** RFC 7636 — the only supported PKCE transformation. "plain" is
 * deliberately never accepted (see dto validation), so this is the only
 * method OAuthAuthorizationCode rows ever store. */
export const PKCE_METHOD_S256 = 'S256';

/**
 * code_verifier must be a 43-128 character string drawn from the
 * "unreserved" URL-safe character set (RFC 7636 §4.1).
 */
export const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

/** Computes the S256 code_challenge for a given code_verifier — used both
 * when validating an incoming authorize request's shape isn't needed here
 * (the client computes it), and by tests exercising the token exchange. */
export function computeCodeChallengeS256(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

/** Constant-time comparison of the client-presented code_verifier's
 * derived challenge against the challenge stored at authorization time. */
export function verifyPkce(codeVerifier: string, expectedCodeChallenge: string): boolean {
  const actual = computeCodeChallengeS256(codeVerifier);
  return EncryptionService.safeEqual(actual, expectedCodeChallenge);
}
