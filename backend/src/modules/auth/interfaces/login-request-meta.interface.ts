/**
 * v2.2 Security Center — request-level metadata AuthController.login() and
 * the security module's MFA-verify-login endpoint pass through to
 * AuthService so a new Session row can record where/what a login came from.
 * Entirely optional everywhere it's threaded through, so any existing
 * caller that omits it keeps the exact pre-v2.2 behavior.
 */
export interface LoginRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}
