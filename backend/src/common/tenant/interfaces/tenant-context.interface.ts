export interface TenantContext {
  organizationId: string;
  userId: string;
  membershipId: string;
  requestId: string;
}

export interface TenantJwtPrincipal {
  userId: string;
  organizationId: string;
}
