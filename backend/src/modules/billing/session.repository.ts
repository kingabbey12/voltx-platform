import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CheckoutSessionEntity,
  CheckoutSessionStatus,
  CustomerPortalSessionEntity,
} from './entities/session.entity';

interface CheckoutSessionRecord {
  id: string;
  organizationId: string;
  billingAccountId: string;
  planId: string | null;
  stripeSessionId: string;
  url: string;
  status: CheckoutSessionStatus;
  metadata: unknown;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface PortalSessionRecord {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripeSessionId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateCheckoutSessionData {
  organizationId: string;
  billingAccountId: string;
  planId?: string | null;
  stripeSessionId: string;
  url: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface CreatePortalSessionData {
  organizationId: string;
  billingAccountId: string;
  stripeSessionId: string;
  url: string;
  expiresAt?: Date | null;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutSession(data: CreateCheckoutSessionData): Promise<CheckoutSessionEntity> {
    const record = await this.prisma.system.checkoutSession.create({
      data: {
        organizationId: data.organizationId,
        billingAccountId: data.billingAccountId,
        planId: data.planId ?? null,
        stripeSessionId: data.stripeSessionId,
        url: data.url,
        expiresAt: data.expiresAt ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return toCheckoutEntity(record);
  }

  async markCheckoutSessionComplete(
    stripeSessionId: string,
  ): Promise<CheckoutSessionEntity | null> {
    const existing = await this.prisma.system.checkoutSession.findUnique({
      where: { stripeSessionId },
    });
    if (!existing) return null;
    const record = await this.prisma.system.checkoutSession.update({
      where: { stripeSessionId },
      data: { status: 'COMPLETE', completedAt: new Date() },
    });
    return toCheckoutEntity(record);
  }

  async createPortalSession(data: CreatePortalSessionData): Promise<CustomerPortalSessionEntity> {
    const record = await this.prisma.system.customerPortalSession.create({
      data: {
        organizationId: data.organizationId,
        billingAccountId: data.billingAccountId,
        stripeSessionId: data.stripeSessionId,
        url: data.url,
        expiresAt: data.expiresAt ?? null,
      },
    });
    return toPortalEntity(record);
  }
}

function toCheckoutEntity(record: CheckoutSessionRecord): CheckoutSessionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    billingAccountId: record.billingAccountId,
    planId: record.planId,
    stripeSessionId: record.stripeSessionId,
    url: record.url,
    status: record.status,
    metadata: (record.metadata ?? {}) as Record<string, unknown>,
    completedAt: record.completedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

function toPortalEntity(record: PortalSessionRecord): CustomerPortalSessionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    billingAccountId: record.billingAccountId,
    stripeSessionId: record.stripeSessionId,
    url: record.url,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}
