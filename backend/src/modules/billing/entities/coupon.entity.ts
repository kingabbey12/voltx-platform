export type CouponDuration = 'ONCE' | 'REPEATING' | 'FOREVER';

export interface CouponEntity {
  id: string;
  stripeCouponId: string;
  key: string;
  percentOff: number | null;
  amountOffUsd: number | null;
  duration: CouponDuration;
  durationInMonths: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionEntity {
  id: string;
  stripePromotionCodeId: string;
  couponId: string;
  code: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountEntity {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  couponId: string;
  promotionId: string | null;
  appliedAt: Date;
  expiresAt: Date | null;
}
