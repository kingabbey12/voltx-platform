export type SubscriptionStatus =
  'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'UNPAID' | 'PAUSED';

export type SubscriptionChangeType =
  'UPGRADE' | 'DOWNGRADE' | 'CANCEL' | 'RESUME' | 'TRIAL_START' | 'TRIAL_END' | 'SEAT_CHANGE';

export interface SubscriptionEntity {
  id: string;
  organizationId: string;
  billingAccountId: string;
  planId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionChangeEntity {
  id: string;
  subscriptionId: string;
  fromPlanId: string | null;
  toPlanId: string | null;
  changeType: SubscriptionChangeType;
  effectiveAt: Date;
  initiatedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
