export interface TenantContext {
  organizationId: string;
  userId: string;
  membershipId: string;
  requestId: string;
  /** v2.2 Customer Success — present only when the current request authenticated with an impersonation access token. */
  supportSessionId?: string;
}

export interface TenantJwtPrincipal {
  userId: string;
  organizationId: string;
}
