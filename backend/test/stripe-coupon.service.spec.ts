import { NotFoundException } from '@nestjs/common';
import {
  StripeCouponService,
  mapCouponDuration,
} from '../src/modules/billing/stripe/stripe-coupon.service';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { CouponRepository } from '../src/modules/billing/coupon.repository';
import { AuditService } from '../src/modules/audit/audit.service';

describe('mapCouponDuration', () => {
  it.each([
    ['once', 'ONCE'],
    ['repeating', 'REPEATING'],
    ['forever', 'FOREVER'],
  ])('maps Stripe duration %s to %s', (stripeDuration, expected) => {
    expect(mapCouponDuration(stripeDuration as never)).toBe(expected);
  });
});

describe('StripeCouponService', () => {
  let stripeClientService: jest.Mocked<StripeClientService>;
  let couponRepository: jest.Mocked<CouponRepository>;
  let auditService: jest.Mocked<AuditService>;
  let service: StripeCouponService;

  beforeEach(() => {
    stripeClientService = {
      client: {
        coupons: { retrieve: jest.fn() },
        promotionCodes: { retrieve: jest.fn(), list: jest.fn() },
        subscriptions: { update: jest.fn() },
      },
    } as never;
    couponRepository = {
      upsertCoupon: jest.fn(),
      findCouponByStripeId: jest.fn(),
      listActiveCoupons: jest.fn(),
      upsertPromotion: jest.fn(),
      findPromotionByCode: jest.fn(),
      incrementRedeemedCount: jest.fn(),
      createDiscount: jest.fn(),
      listDiscountsForOrganization: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;

    service = new StripeCouponService(stripeClientService, couponRepository, auditService);
  });

  describe('syncCoupon', () => {
    it('mirrors a Stripe coupon into the local catalog', async () => {
      (stripeClientService.client.coupons.retrieve as jest.Mock).mockResolvedValue({
        id: 'coupon_123',
        name: 'LAUNCH20',
        percent_off: 20,
        amount_off: null,
        duration: 'once',
        duration_in_months: null,
      });
      couponRepository.upsertCoupon.mockResolvedValue({ id: 'local-coupon-1' } as never);

      const result = await service.syncCoupon('coupon_123');

      expect(couponRepository.upsertCoupon).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCouponId: 'coupon_123', percentOff: 20, duration: 'ONCE' }),
      );
      expect(result).toEqual({ id: 'local-coupon-1' });
    });
  });

  describe('syncPromotionCode', () => {
    it('throws NotFoundException when the promotion has no coupon attached', async () => {
      (stripeClientService.client.promotionCodes.retrieve as jest.Mock).mockResolvedValue({
        id: 'promo_123',
        code: 'LAUNCH20',
        promotion: { coupon: null, type: 'coupon' },
      });

      await expect(service.syncPromotionCode('promo_123')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('syncs the underlying coupon and mirrors the promotion code', async () => {
      (stripeClientService.client.promotionCodes.retrieve as jest.Mock).mockResolvedValue({
        id: 'promo_123',
        code: 'LAUNCH20',
        max_redemptions: 100,
        expires_at: null,
        active: true,
        promotion: { coupon: { id: 'coupon_123' }, type: 'coupon' },
      });
      (stripeClientService.client.coupons.retrieve as jest.Mock).mockResolvedValue({
        id: 'coupon_123',
        name: 'LAUNCH20',
        percent_off: 20,
        amount_off: null,
        duration: 'once',
        duration_in_months: null,
      });
      couponRepository.upsertCoupon.mockResolvedValue({ id: 'local-coupon-1' } as never);
      couponRepository.upsertPromotion.mockResolvedValue({ id: 'local-promo-1' } as never);

      const result = await service.syncPromotionCode('promo_123');

      expect(couponRepository.upsertPromotion).toHaveBeenCalledWith(
        expect.objectContaining({ stripePromotionCodeId: 'promo_123', couponId: 'local-coupon-1' }),
      );
      expect(result).toEqual({ id: 'local-promo-1' });
    });
  });

  describe('redeemPromotionCode', () => {
    it('throws NotFoundException when the code is not found or inactive', async () => {
      (stripeClientService.client.promotionCodes.list as jest.Mock).mockResolvedValue({ data: [] });

      await expect(
        service.redeemPromotionCode('org-1', 'EXPIRED', 'sub_stripe_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('applies the promotion to the Stripe subscription and records a local Discount', async () => {
      (stripeClientService.client.promotionCodes.list as jest.Mock).mockResolvedValue({
        data: [{ id: 'promo_123', code: 'LAUNCH20' }],
      });
      (stripeClientService.client.promotionCodes.retrieve as jest.Mock).mockResolvedValue({
        id: 'promo_123',
        code: 'LAUNCH20',
        max_redemptions: 100,
        expires_at: null,
        active: true,
        promotion: { coupon: { id: 'coupon_123' }, type: 'coupon' },
      });
      (stripeClientService.client.coupons.retrieve as jest.Mock).mockResolvedValue({
        id: 'coupon_123',
        name: 'LAUNCH20',
        percent_off: 20,
        amount_off: null,
        duration: 'once',
        duration_in_months: null,
      });
      couponRepository.upsertCoupon.mockResolvedValue({ id: 'local-coupon-1' } as never);
      couponRepository.upsertPromotion.mockResolvedValue({
        id: 'local-promo-1',
        couponId: 'local-coupon-1',
        expiresAt: null,
      } as never);
      couponRepository.createDiscount.mockResolvedValue({ id: 'discount-1' } as never);

      const result = await service.redeemPromotionCode('org-1', 'LAUNCH20', 'sub_stripe_1');

      expect(stripeClientService.client.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
        discounts: [{ promotion_code: 'promo_123' }],
      });
      expect(couponRepository.createDiscount).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', couponId: 'local-coupon-1' }),
      );
      expect(result).toEqual({ id: 'discount-1' });
    });

    it('skips applying to Stripe when there is no Stripe subscription yet', async () => {
      (stripeClientService.client.promotionCodes.list as jest.Mock).mockResolvedValue({
        data: [{ id: 'promo_123', code: 'LAUNCH20' }],
      });
      (stripeClientService.client.promotionCodes.retrieve as jest.Mock).mockResolvedValue({
        id: 'promo_123',
        code: 'LAUNCH20',
        max_redemptions: 100,
        expires_at: null,
        active: true,
        promotion: { coupon: { id: 'coupon_123' }, type: 'coupon' },
      });
      (stripeClientService.client.coupons.retrieve as jest.Mock).mockResolvedValue({
        id: 'coupon_123',
        name: 'LAUNCH20',
        percent_off: 20,
        amount_off: null,
        duration: 'once',
        duration_in_months: null,
      });
      couponRepository.upsertCoupon.mockResolvedValue({ id: 'local-coupon-1' } as never);
      couponRepository.upsertPromotion.mockResolvedValue({
        id: 'local-promo-1',
        couponId: 'local-coupon-1',
        expiresAt: null,
      } as never);
      couponRepository.createDiscount.mockResolvedValue({ id: 'discount-1' } as never);

      await service.redeemPromotionCode('org-1', 'LAUNCH20', null);

      expect(stripeClientService.client.subscriptions.update).not.toHaveBeenCalled();
    });
  });
});
