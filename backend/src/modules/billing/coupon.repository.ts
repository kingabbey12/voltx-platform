import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CouponDuration,
  CouponEntity,
  DiscountEntity,
  PromotionEntity,
} from './entities/coupon.entity';

interface CouponRecord {
  id: string;
  stripeCouponId: string;
  key: string;
  percentOff: { toString(): string } | null;
  amountOffUsd: { toString(): string } | null;
  duration: CouponDuration;
  durationInMonths: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PromotionRecord {
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

interface DiscountRecord {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  couponId: string;
  promotionId: string | null;
  appliedAt: Date;
  expiresAt: Date | null;
}

export interface UpsertCouponData {
  stripeCouponId: string;
  key: string;
  percentOff?: number | null;
  amountOffUsd?: number | null;
  duration: CouponDuration;
  durationInMonths?: number | null;
}

export interface UpsertPromotionData {
  stripePromotionCodeId: string;
  couponId: string;
  code: string;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
  isActive?: boolean;
}

export interface CreateDiscountData {
  organizationId: string;
  subscriptionId?: string | null;
  couponId: string;
  promotionId?: string | null;
  expiresAt?: Date | null;
}

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCoupon(data: UpsertCouponData): Promise<CouponEntity> {
    const record = await this.prisma.system.coupon.upsert({
      where: { stripeCouponId: data.stripeCouponId },
      create: {
        stripeCouponId: data.stripeCouponId,
        key: data.key,
        percentOff: data.percentOff ?? null,
        amountOffUsd: data.amountOffUsd ?? null,
        duration: data.duration,
        durationInMonths: data.durationInMonths ?? null,
      },
      update: {
        percentOff: data.percentOff ?? null,
        amountOffUsd: data.amountOffUsd ?? null,
        duration: data.duration,
        durationInMonths: data.durationInMonths ?? null,
      },
    });
    return toCouponEntity(record);
  }

  async findCouponByStripeId(stripeCouponId: string): Promise<CouponEntity | null> {
    const record = await this.prisma.system.coupon.findUnique({ where: { stripeCouponId } });
    return record ? toCouponEntity(record) : null;
  }

  async listActiveCoupons(): Promise<CouponEntity[]> {
    const records = await this.prisma.system.coupon.findMany({ where: { isActive: true } });
    return records.map(toCouponEntity);
  }

  async upsertPromotion(data: UpsertPromotionData): Promise<PromotionEntity> {
    const record = await this.prisma.system.promotion.upsert({
      where: { stripePromotionCodeId: data.stripePromotionCodeId },
      create: {
        stripePromotionCodeId: data.stripePromotionCodeId,
        couponId: data.couponId,
        code: data.code,
        maxRedemptions: data.maxRedemptions ?? null,
        expiresAt: data.expiresAt ?? null,
        isActive: data.isActive ?? true,
      },
      update: {
        maxRedemptions: data.maxRedemptions ?? null,
        expiresAt: data.expiresAt ?? null,
        isActive: data.isActive ?? true,
      },
    });
    return toPromotionEntity(record);
  }

  async findPromotionByCode(code: string): Promise<PromotionEntity | null> {
    const record = await this.prisma.system.promotion.findUnique({ where: { code } });
    return record ? toPromotionEntity(record) : null;
  }

  async incrementRedeemedCount(id: string): Promise<PromotionEntity> {
    const record = await this.prisma.system.promotion.update({
      where: { id },
      data: { redeemedCount: { increment: 1 } },
    });
    return toPromotionEntity(record);
  }

  async createDiscount(data: CreateDiscountData): Promise<DiscountEntity> {
    const record = await this.prisma.system.discount.create({
      data: {
        organizationId: data.organizationId,
        subscriptionId: data.subscriptionId ?? null,
        couponId: data.couponId,
        promotionId: data.promotionId ?? null,
        expiresAt: data.expiresAt ?? null,
      },
    });
    return toDiscountEntity(record);
  }

  async listDiscountsForOrganization(organizationId: string): Promise<DiscountEntity[]> {
    const records = await this.prisma.system.discount.findMany({
      where: { organizationId },
      orderBy: [{ appliedAt: 'desc' }],
    });
    return records.map(toDiscountEntity);
  }
}

function toCouponEntity(record: CouponRecord): CouponEntity {
  return {
    id: record.id,
    stripeCouponId: record.stripeCouponId,
    key: record.key,
    percentOff: record.percentOff ? Number(record.percentOff) : null,
    amountOffUsd: record.amountOffUsd ? Number(record.amountOffUsd) : null,
    duration: record.duration,
    durationInMonths: record.durationInMonths,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPromotionEntity(record: PromotionRecord): PromotionEntity {
  return {
    id: record.id,
    stripePromotionCodeId: record.stripePromotionCodeId,
    couponId: record.couponId,
    code: record.code,
    maxRedemptions: record.maxRedemptions,
    redeemedCount: record.redeemedCount,
    expiresAt: record.expiresAt,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toDiscountEntity(record: DiscountRecord): DiscountEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    subscriptionId: record.subscriptionId,
    couponId: record.couponId,
    promotionId: record.promotionId,
    appliedAt: record.appliedAt,
    expiresAt: record.expiresAt,
  };
}
