import { Injectable, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeClientService } from './stripe-client.service';
import { CouponRepository } from '../coupon.repository';
import {
  CouponEntity,
  CouponDuration,
  DiscountEntity,
  PromotionEntity,
} from '../entities/coupon.entity';
import { AuditService } from '../../audit/audit.service';

/**
 * Coupons/Promotion Codes are typically created in the Stripe Dashboard
 * (rarely by end users) — this service is deliberately read-mostly-sync:
 * `syncFromStripe` mirrors a Coupon/PromotionCode Stripe already knows
 * about into the local catalog, and `redeem` applies an already-synced
 * promotion code to an organization's subscription.
 */
@Injectable()
export class StripeCouponService {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly couponRepository: CouponRepository,
    private readonly auditService: AuditService,
  ) {}

  async syncCoupon(stripeCouponId: string): Promise<CouponEntity> {
    const coupon = await this.stripeClientService.client.coupons.retrieve(stripeCouponId);
    return this.couponRepository.upsertCoupon({
      stripeCouponId: coupon.id,
      key: coupon.name ?? coupon.id,
      percentOff: coupon.percent_off ?? null,
      amountOffUsd: coupon.amount_off ? coupon.amount_off / 100 : null,
      duration: mapCouponDuration(coupon.duration),
      durationInMonths: coupon.duration_in_months ?? null,
    });
  }

  async syncPromotionCode(stripePromotionCodeId: string): Promise<PromotionEntity> {
    const promotionCode =
      await this.stripeClientService.client.promotionCodes.retrieve(stripePromotionCodeId);
    const coupon = promotionCode.promotion.coupon;
    const couponId = typeof coupon === 'string' ? coupon : coupon?.id;
    if (!couponId) {
      throw new NotFoundException(
        `Promotion code "${stripePromotionCodeId}" has no coupon attached`,
      );
    }
    const localCoupon = await this.syncCoupon(couponId);

    return this.couponRepository.upsertPromotion({
      stripePromotionCodeId: promotionCode.id,
      couponId: localCoupon.id,
      code: promotionCode.code,
      maxRedemptions: promotionCode.max_redemptions ?? null,
      expiresAt: promotionCode.expires_at ? new Date(promotionCode.expires_at * 1000) : null,
      isActive: promotionCode.active,
    });
  }

  /** Applies a customer-facing promotion code to an org's subscription — validated against Stripe first (redemption limits, expiry, active state), then applied to the Stripe subscription and mirrored as a local Discount. */
  async redeemPromotionCode(
    organizationId: string,
    code: string,
    stripeSubscriptionId: string | null,
  ): Promise<DiscountEntity> {
    const promotionCodes = await this.stripeClientService.client.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    const promotionCode = promotionCodes.data[0];
    if (!promotionCode) {
      throw new NotFoundException(`Promotion code "${code}" not found or no longer active`);
    }

    if (stripeSubscriptionId) {
      await this.stripeClientService.client.subscriptions.update(stripeSubscriptionId, {
        discounts: [{ promotion_code: promotionCode.id }],
      });
    }

    const promotion = await this.syncPromotionCode(promotionCode.id);
    const discount = await this.couponRepository.createDiscount({
      organizationId,
      couponId: promotion.couponId,
      promotionId: promotion.id,
      expiresAt: promotion.expiresAt,
    });

    await this.auditService.record({
      action: 'billing.coupon.redeem',
      resource: 'billing_discount',
      resourceId: discount.id,
      metadata: { code },
    });

    return discount;
  }
}

export function mapCouponDuration(duration: Stripe.Coupon.Duration): CouponDuration {
  if (duration === 'repeating') return 'REPEATING';
  if (duration === 'forever') return 'FOREVER';
  return 'ONCE';
}
