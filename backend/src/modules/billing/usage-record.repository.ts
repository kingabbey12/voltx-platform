import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UsageRecordEntity, UsageSnapshotEntity } from './entities/usage.entity';

interface UsageRecordRow {
  id: string;
  organizationId: string;
  featureKey: string;
  quantity: bigint;
  metadata: unknown;
  periodStart: Date;
  periodEnd: Date;
  recordedAt: Date;
}

interface UsageSnapshotRow {
  id: string;
  organizationId: string;
  featureKey: string;
  periodStart: Date;
  periodEnd: Date;
  totalQuantity: bigint;
  computedAt: Date;
}

export interface CreateUsageRecordData {
  organizationId: string;
  featureKey: string;
  quantity: number;
  metadata?: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
}

export interface UpsertUsageSnapshotData {
  organizationId: string;
  featureKey: string;
  periodStart: Date;
  periodEnd: Date;
  totalQuantity: number;
}

export interface PeriodUsageTotal {
  organizationId: string;
  featureKey: string;
  periodStart: Date;
  periodEnd: Date;
  totalQuantity: number;
}

@Injectable()
export class UsageRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUsageRecordData): Promise<UsageRecordEntity> {
    const record = await this.prisma.system.usageRecord.create({
      data: {
        organizationId: data.organizationId,
        featureKey: data.featureKey,
        quantity: BigInt(Math.max(0, Math.round(data.quantity))),
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });
    return toEntity(record);
  }

  async sumForPeriod(
    organizationId: string,
    featureKey: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const result = await this.prisma.system.usageRecord.aggregate({
      where: { organizationId, featureKey, periodStart, periodEnd },
      _sum: { quantity: true },
    });
    return result._sum.quantity ? Number(result._sum.quantity) : 0;
  }

  /**
   * Groups every still-open period's usage by (organization, feature) —
   * feeds the nightly UsageSnapshot rollup. Scoped to periods that
   * haven't ended yet as of `asOf`, since a period that already closed
   * would already have been snapshotted on a prior night and never
   * accumulates further records.
   */
  async sumOpenPeriodsGroupedByOrganizationAndFeature(asOf: Date): Promise<PeriodUsageTotal[]> {
    const grouped = await this.prisma.system.usageRecord.groupBy({
      by: ['organizationId', 'featureKey', 'periodStart', 'periodEnd'],
      where: { periodEnd: { gte: asOf } },
      _sum: { quantity: true },
    });

    return grouped.map((row) => ({
      organizationId: row.organizationId,
      featureKey: row.featureKey,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      totalQuantity: row._sum.quantity ? Number(row._sum.quantity) : 0,
    }));
  }

  async upsertSnapshot(data: UpsertUsageSnapshotData): Promise<UsageSnapshotEntity> {
    const record = await this.prisma.system.usageSnapshot.upsert({
      where: {
        organizationId_featureKey_periodStart: {
          organizationId: data.organizationId,
          featureKey: data.featureKey,
          periodStart: data.periodStart,
        },
      },
      create: {
        organizationId: data.organizationId,
        featureKey: data.featureKey,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalQuantity: BigInt(Math.max(0, Math.round(data.totalQuantity))),
      },
      update: {
        totalQuantity: BigInt(Math.max(0, Math.round(data.totalQuantity))),
        computedAt: new Date(),
      },
    });
    return toSnapshotEntity(record);
  }

  async listSnapshotsForOrganization(
    organizationId: string,
    featureKey?: string,
    limit = 90,
  ): Promise<UsageSnapshotEntity[]> {
    const records = await this.prisma.system.usageSnapshot.findMany({
      where: { organizationId, ...(featureKey ? { featureKey } : {}) },
      orderBy: [{ periodStart: 'desc' }],
      take: limit,
    });
    return records.map(toSnapshotEntity);
  }
}

function toEntity(record: UsageRecordRow): UsageRecordEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    featureKey: record.featureKey,
    quantity: Number(record.quantity),
    metadata: (record.metadata ?? {}) as Record<string, unknown>,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    recordedAt: record.recordedAt,
  };
}

function toSnapshotEntity(record: UsageSnapshotRow): UsageSnapshotEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    featureKey: record.featureKey,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    totalQuantity: Number(record.totalQuantity),
    computedAt: record.computedAt,
  };
}
