export interface JwtAccessPayload {
  sub: string;
  org?: string;
  type: 'access';
}

/**
 * v2.2 Security Center — payload of the short-lived token AuthService.login()
 * issues in place of full JWTs when a second factor is required. Deliberately
 * a distinct `type` so JwtAccessStrategy (which requires `type === 'access'`)
 * can never accept one of these as a bearer access token — the two token
 * kinds are structurally unable to be confused with each other.
 */
export interface MfaChallengePayload {
  sub: string;
  org: string;
  type: 'mfa_challenge';
}
