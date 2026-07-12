export type QuotaDenialReason = 'QUOTA_EXCEEDED' | 'SUBSCRIPTION_INACTIVE';

export interface QuotaCheckResult {
  allowed: boolean;
  featureKey: string;
  /** null = unlimited on this plan. */
  limit: number | null;
  currentUsage: number;
  /** null = unlimited on this plan. */
  remaining: number | null;
  reason?: QuotaDenialReason;
}
