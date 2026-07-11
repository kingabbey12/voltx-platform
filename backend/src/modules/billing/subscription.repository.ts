import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  SubscriptionChangeEntity,
  SubscriptionChangeType,
  SubscriptionEntity,
  SubscriptionStatus,
} from './entities/subscription.entity';

interface SubscriptionRecord {
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

interface SubscriptionChangeRecord {
  id: string;
  subscriptionId: string;
  fromPlanId: string | null;
  toPlanId: string | null;
  changeType: SubscriptionChangeType;
  effectiveAt: Date;
  initiatedBy: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface CreateSubscriptionData {
  organizationId: string;
  billingAccountId: string;
  planId: string;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  stripeSubscriptionId?: string | null;
}

export interface UpdateSubscriptionData {
  planId?: string;
  status?: SubscriptionStatus;
  seats?: number;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  stripeSubscriptionId?: string | null;
}

export interface CreateSubscriptionChangeData {
  subscriptionId: string;
  fromPlanId?: string | null;
  toPlanId?: string | null;
  changeType: SubscriptionChangeType;
  effectiveAt: Date;
  initiatedBy?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SubscriptionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Called at registration, before this brand-new organization
   * necessarily has tenant context established — takes organizationId
   * explicitly rather than reading TenantContextService.
   */
  async create(data: CreateSubscriptionData): Promise<SubscriptionEntity> {
    const record = await this.prisma.system.subscription.create({
      data: {
        organizationId: data.organizationId,
        billingAccountId: data.billingAccountId,
        planId: data.planId,
        status: data.status,
        seats: data.seats,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialStart: data.trialStart ?? null,
        trialEnd: data.trialEnd ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.system.subscription.findFirst({
      where: { id },
    });
    return record ? toEntity(record) : null;
  }

  /** The org's current subscription — most recently created row. */
  async findCurrentForOrganization(organizationId: string): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.system.subscription.findFirst({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return record ? toEntity(record) : null;
  }

  async findCurrentForCurrentOrganization(): Promise<SubscriptionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.findCurrentForOrganization(tenant.organizationId);
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.system.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    return record ? toEntity(record) : null;
  }

  /** Every subscription still trialing whose trial has passed — used by the hourly trial-expiry sweep (Phase 3). */
  async findExpiredTrials(now: Date): Promise<SubscriptionEntity[]> {
    const records = await this.prisma.system.subscription.findMany({
      where: { status: 'TRIALING', trialEnd: { lt: now } },
    });
    return records.map(toEntity);
  }

  async update(id: string, data: UpdateSubscriptionData): Promise<SubscriptionEntity> {
    const record = await this.prisma.system.subscription.update({
      where: { id },
      data: {
        ...(data.planId !== undefined ? { planId: data.planId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.seats !== undefined ? { seats: data.seats } : {}),
        ...(data.currentPeriodStart !== undefined
          ? { currentPeriodStart: data.currentPeriodStart }
          : {}),
        ...(data.currentPeriodEnd !== undefined ? { currentPeriodEnd: data.currentPeriodEnd } : {}),
        ...(data.trialStart !== undefined ? { trialStart: data.trialStart } : {}),
        ...(data.trialEnd !== undefined ? { trialEnd: data.trialEnd } : {}),
        ...(data.cancelAtPeriodEnd !== undefined
          ? { cancelAtPeriodEnd: data.cancelAtPeriodEnd }
          : {}),
        ...(data.canceledAt !== undefined ? { canceledAt: data.canceledAt } : {}),
        ...(data.stripeSubscriptionId !== undefined
          ? { stripeSubscriptionId: data.stripeSubscriptionId }
          : {}),
      },
    });
    return toEntity(record);
  }

  async recordChange(data: CreateSubscriptionChangeData): Promise<SubscriptionChangeEntity> {
    const record = await this.prisma.system.subscriptionChange.create({
      data: {
        subscriptionId: data.subscriptionId,
        fromPlanId: data.fromPlanId ?? null,
        toPlanId: data.toPlanId ?? null,
        changeType: data.changeType,
        effectiveAt: data.effectiveAt,
        initiatedBy: data.initiatedBy ?? null,
        metadata: (data.metadata ?? {}) as never,
      },
    });
    return toChangeEntity(record);
  }

  async listChanges(subscriptionId: string): Promise<SubscriptionChangeEntity[]> {
    const records = await this.prisma.system.subscriptionChange.findMany({
      where: { subscriptionId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return records.map(toChangeEntity);
  }
}

function toEntity(record: SubscriptionRecord): SubscriptionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    billingAccountId: record.billingAccountId,
    planId: record.planId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    status: record.status,
    seats: record.seats,
    currentPeriodStart: record.currentPeriodStart,
    currentPeriodEnd: record.currentPeriodEnd,
    trialStart: record.trialStart,
    trialEnd: record.trialEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    canceledAt: record.canceledAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toChangeEntity(record: SubscriptionChangeRecord): SubscriptionChangeEntity {
  return {
    id: record.id,
    subscriptionId: record.subscriptionId,
    fromPlanId: record.fromPlanId,
    toPlanId: record.toPlanId,
    changeType: record.changeType,
    effectiveAt: record.effectiveAt,
    initiatedBy: record.initiatedBy,
    metadata: (record.metadata ?? {}) as Record<string, unknown>,
    createdAt: record.createdAt,
  };
}
