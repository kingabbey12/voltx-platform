import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FeatureEntity, FeatureUnit, PlanEntity, PlanWithLimits } from './entities/plan.entity';

interface PlanRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  stripeProductId: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  priceMonthlyUsd: { toString(): string } | null;
  priceYearlyUsd: { toString(): string } | null;
  isActive: boolean;
  sortOrder: number;
  trialDays: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureRecord {
  id: string;
  key: string;
  name: string;
  unit: FeatureUnit;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureLimitRecord {
  id: string;
  planId: string;
  featureId: string;
  limit: bigint | null;
  softLimitPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
  feature: FeatureRecord;
}

@Injectable()
export class PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Plans are Voltx's own platform catalog — org-less, never tenant-scoped. */
  async findAllActive(): Promise<PlanEntity[]> {
    const records = await this.prisma.system.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }],
    });
    return records.map(toPlanEntity);
  }

  async findByKey(key: string): Promise<PlanEntity | null> {
    const record = await this.prisma.system.plan.findUnique({ where: { key } });
    return record ? toPlanEntity(record) : null;
  }

  async findById(id: string): Promise<PlanEntity | null> {
    const record = await this.prisma.system.plan.findUnique({ where: { id } });
    return record ? toPlanEntity(record) : null;
  }

  async findByIdWithLimits(id: string): Promise<PlanWithLimits | null> {
    const plan = await this.prisma.system.plan.findUnique({
      where: { id },
      include: { featureLimits: { include: { feature: true } } },
    });
    return plan ? toPlanWithLimits(plan) : null;
  }

  async findByKeyWithLimits(key: string): Promise<PlanWithLimits | null> {
    const plan = await this.prisma.system.plan.findUnique({
      where: { key },
      include: { featureLimits: { include: { feature: true } } },
    });
    return plan ? toPlanWithLimits(plan) : null;
  }

  async listFeatures(): Promise<FeatureEntity[]> {
    const records = await this.prisma.system.feature.findMany({ orderBy: [{ category: 'asc' }] });
    return records.map(toFeatureEntity);
  }

  async findFeatureByKey(key: string): Promise<FeatureEntity | null> {
    const record = await this.prisma.system.feature.findUnique({ where: { key } });
    return record ? toFeatureEntity(record) : null;
  }

  /** Webhook-driven — resolves a Stripe subscription's price back to the local Plan it corresponds to. */
  async findByStripePriceId(stripePriceId: string): Promise<PlanEntity | null> {
    const record = await this.prisma.system.plan.findFirst({
      where: {
        OR: [{ stripePriceIdMonthly: stripePriceId }, { stripePriceIdYearly: stripePriceId }],
      },
    });
    return record ? toPlanEntity(record) : null;
  }
}

function toPlanEntity(record: PlanRecord): PlanEntity {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: record.description,
    stripeProductId: record.stripeProductId,
    stripePriceIdMonthly: record.stripePriceIdMonthly,
    stripePriceIdYearly: record.stripePriceIdYearly,
    priceMonthlyUsd: record.priceMonthlyUsd ? Number(record.priceMonthlyUsd) : null,
    priceYearlyUsd: record.priceYearlyUsd ? Number(record.priceYearlyUsd) : null,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    trialDays: record.trialDays,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toFeatureEntity(record: FeatureRecord): FeatureEntity {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    unit: record.unit,
    category: record.category,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPlanWithLimits(
  record: PlanRecord & { featureLimits: FeatureLimitRecord[] },
): PlanWithLimits {
  return {
    ...toPlanEntity(record),
    limits: record.featureLimits.map((limit) => ({
      featureKey: limit.feature.key,
      unit: limit.feature.unit,
      limit: limit.limit === null ? null : Number(limit.limit),
      softLimitPercent: limit.softLimitPercent,
    })),
  };
}
