export interface PlanEntity {
  id: string;
  key: string;
  name: string;
  description: string | null;
  stripeProductId: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  priceMonthlyUsd: number | null;
  priceYearlyUsd: number | null;
  isActive: boolean;
  sortOrder: number;
  trialDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FeatureUnit = 'COUNT' | 'TOKENS' | 'BYTES' | 'MINUTES';

export interface FeatureEntity {
  id: string;
  key: string;
  name: string;
  unit: FeatureUnit;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureLimitEntity {
  id: string;
  planId: string;
  featureId: string;
  /** null = unlimited. */
  limit: number | null;
  softLimitPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A plan with its feature limits joined in, keyed by feature key — the shape PlanService/QuotaService actually consume. */
export interface PlanWithLimits extends PlanEntity {
  limits: Array<{
    featureKey: string;
    unit: FeatureUnit;
    limit: number | null;
    softLimitPercent: number | null;
  }>;
}
