import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  IntegrationSyncRunEntity,
  IntegrationSyncStatus,
  IntegrationSyncTrigger,
} from './entities/integration-support.entity';

export interface CreateIntegrationSyncRunData {
  organizationId: string;
  connectionId: string;
  trigger: IntegrationSyncTrigger;
}

export interface UpdateIntegrationSyncRunData {
  status?: IntegrationSyncStatus;
  completedAt?: Date;
  durationMs?: number;
  itemsProcessed?: number;
  itemsFailed?: number;
  error?: string | null;
}

interface IntegrationSyncRunRecord {
  id: string;
  organizationId: string;
  connectionId: string;
  trigger: IntegrationSyncTrigger;
  status: IntegrationSyncStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  itemsProcessed: number;
  itemsFailed: number;
  error: string | null;
  createdAt: Date;
}

interface IntegrationSyncRunClient {
  create(args: { data: Record<string, unknown> }): Promise<IntegrationSyncRunRecord>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<IntegrationSyncRunRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<IntegrationSyncRunRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

@Injectable()
export class IntegrationSyncRunRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateIntegrationSyncRunData): Promise<IntegrationSyncRunEntity> {
    const record = await this.client().create({
      data: {
        organizationId: data.organizationId,
        connectionId: data.connectionId,
        trigger: data.trigger,
      },
    });
    return toEntity(record);
  }

  async update(id: string, data: UpdateIntegrationSyncRunData): Promise<IntegrationSyncRunEntity> {
    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
        ...(data.itemsProcessed !== undefined ? { itemsProcessed: data.itemsProcessed } : {}),
        ...(data.itemsFailed !== undefined ? { itemsFailed: data.itemsFailed } : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
      },
    });
    return toEntity(record);
  }

  async listByConnection(
    connectionId: string,
    page: number,
    limit: number,
  ): Promise<{ items: IntegrationSyncRunEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { connectionId, organizationId: tenant.organizationId };
    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.client().count({ where }),
    ]);
    return { items: records.map(toEntity), total };
  }

  private client(): IntegrationSyncRunClient {
    return (this.prisma.system as unknown as { integrationSyncRun: IntegrationSyncRunClient })
      .integrationSyncRun;
  }
}

function toEntity(record: IntegrationSyncRunRecord): IntegrationSyncRunEntity {
  return { ...record };
}
