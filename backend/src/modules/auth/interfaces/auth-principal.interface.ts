export interface AuthPrincipal {
  userId: string;
  organizationId?: string;
  /** v2.2 Customer Success — present only when this request authenticated with an impersonation access token. */
  supportSessionId?: string;
}
