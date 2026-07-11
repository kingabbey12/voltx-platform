export type CheckoutSessionStatus = 'OPEN' | 'COMPLETE' | 'EXPIRED';

export interface CheckoutSessionEntity {
  id: string;
  organizationId: string;
  billingAccountId: string;
  planId: string | null;
  stripeSessionId: string;
  url: string;
  status: CheckoutSessionStatus;
  metadata: Record<string, unknown>;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CustomerPortalSessionEntity {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripeSessionId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
}
