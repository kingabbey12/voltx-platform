import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationEventType } from './provider/integration-provider.types';
import { IntegrationEventEntity } from './entities/integration-support.entity';

export interface CreateIntegrationEventData {
  organizationId: string;
  connectionId: string;
  type: IntegrationEventType;
  externalId?: string;
  payload: Record<string, unknown>;
}

interface IntegrationEventRecord {
  id: string;
  organizationId: string;
  connectionId: string;
  type: IntegrationEventType;
  externalId: string | null;
  payload: Prisma.JsonValue;
  processedAt: Date | null;
  createdAt: Date;
}

interface IntegrationEventClient {
  create(args: { data: Record<string, unknown> }): Promise<IntegrationEventRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<IntegrationEventRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<IntegrationEventRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<IntegrationEventRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

@Injectable()
export class IntegrationEventRepository {
  private readonly logger = new Logger(IntegrationEventRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Idempotent by construction: (connectionId, externalId) has a DB unique
   * constraint, so a webhook/poll replay of the same upstream event just
   * returns the row that already exists instead of creating a duplicate —
   * no application-level dedup cache needed.
   */
  async createIfNew(
    data: CreateIntegrationEventData,
  ): Promise<{ event: IntegrationEventEntity; isNew: boolean }> {
    if (data.externalId) {
      const existing = await this.client().findFirst({
        where: { connectionId: data.connectionId, externalId: data.externalId },
      });
      if (existing) {
        return { event: toEntity(existing), isNew: false };
      }
    }

    try {
      const record = await this.client().create({
        data: {
          organizationId: data.organizationId,
          connectionId: data.connectionId,
          type: data.type,
          externalId: data.externalId,
          payload: data.payload,
        },
      });
      return { event: toEntity(record), isNew: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.client().findFirst({
          where: { connectionId: data.connectionId, externalId: data.externalId },
        });
        if (existing) {
          return { event: toEntity(existing), isNew: false };
        }
      }
      throw error;
    }
  }

  async markProcessed(id: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.client().updateMany({
      where: { id, organizationId: tenant.organizationId },
      data: { processedAt: new Date() },
    });
  }

  async listByConnection(
    connectionId: string,
    page: number,
    limit: number,
  ): Promise<{ items: IntegrationEventEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { connectionId, organizationId: tenant.organizationId };
    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client().count({ where }),
    ]);
    return { items: records.map(toEntity), total };
  }

  private client(): IntegrationEventClient {
    return (this.prisma.system as unknown as { integrationEvent: IntegrationEventClient })
      .integrationEvent;
  }
}

function toEntity(record: IntegrationEventRecord): IntegrationEventEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    connectionId: record.connectionId,
    type: record.type,
    externalId: record.externalId,
    payload:
      typeof record.payload === 'object' &&
      record.payload !== null &&
      !Array.isArray(record.payload)
        ? record.payload
        : {},
    processedAt: record.processedAt,
    createdAt: record.createdAt,
  };
}
