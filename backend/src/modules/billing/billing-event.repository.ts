import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BillingEventEntity } from './entities/billing-event.entity';

interface BillingEventRecord {
  id: string;
  stripeEventId: string;
  type: string;
  organizationId: string | null;
  payload: unknown;
  processedAt: Date | null;
  processingError: string | null;
  receivedAt: Date;
}

export interface CreateBillingEventData {
  stripeEventId: string;
  type: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
}

/** The known Postgres unique-violation error code, same convention used
 * elsewhere in this codebase for insert-and-ignore-on-conflict idempotency. */
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class BillingEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Insert-and-ignore-on-conflict on the `stripeEventId` unique
   * constraint — a duplicate webhook delivery is a no-op here, not a
   * duplicate ingestion, matching IntegrationEventRepository's proven
   * (connectionId, externalId) pattern exactly, including its
   * refetch-the-existing-row-on-conflict shape so the caller can inspect
   * whether it was already processed.
   */
  async createIfNew(
    data: CreateBillingEventData,
  ): Promise<{ event: BillingEventEntity; isNew: boolean }> {
    try {
      const record = await this.prisma.system.billingEvent.create({
        data: {
          stripeEventId: data.stripeEventId,
          type: data.type,
          organizationId: data.organizationId ?? null,
          payload: data.payload as Prisma.InputJsonValue,
        },
      });
      return { event: toEntity(record), isNew: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        const existing = await this.prisma.system.billingEvent.findUnique({
          where: { stripeEventId: data.stripeEventId },
        });
        if (existing) {
          return { event: toEntity(existing), isNew: false };
        }
      }
      throw error;
    }
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.system.billingEvent.update({
      where: { id },
      data: { processedAt: new Date(), processingError: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.system.billingEvent.update({
      where: { id },
      data: { processingError: error.slice(0, 2000) },
    });
  }

  async findByStripeEventId(stripeEventId: string): Promise<BillingEventEntity | null> {
    const record = await this.prisma.system.billingEvent.findUnique({ where: { stripeEventId } });
    return record ? toEntity(record) : null;
  }

  async findById(id: string): Promise<BillingEventEntity | null> {
    const record = await this.prisma.system.billingEvent.findUnique({ where: { id } });
    return record ? toEntity(record) : null;
  }
}

function toEntity(record: BillingEventRecord): BillingEventEntity {
  return {
    id: record.id,
    stripeEventId: record.stripeEventId,
    type: record.type,
    organizationId: record.organizationId,
    payload: (record.payload ?? {}) as Record<string, unknown>,
    processedAt: record.processedAt,
    processingError: record.processingError,
    receivedAt: record.receivedAt,
  };
}
