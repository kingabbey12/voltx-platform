import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

export interface CreateIntegrationApiUsageLogData {
  organizationId: string;
  connectionId: string;
  action: string;
  statusCode?: number;
  durationMs: number;
  rateLimitRemaining?: number;
  retryCount?: number;
  error?: string;
}

export interface IntegrationUsageAggregate {
  totalCalls: number;
  failedCalls: number;
  totalRetries: number;
  averageDurationMs: number;
  minRateLimitRemaining: number | null;
}

interface IntegrationApiUsageLogClient {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<
    Array<{
      id: string;
      action: string;
      statusCode: number | null;
      durationMs: number;
      rateLimitRemaining: number | null;
      retryCount: number;
      error: string | null;
      createdAt: Date;
    }>
  >;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  aggregate(args: {
    where: Record<string, unknown>;
    _avg?: Record<string, boolean>;
    _sum?: Record<string, boolean>;
    _min?: Record<string, boolean>;
    _count?: Record<string, boolean>;
  }): Promise<{
    _avg: Record<string, number | null>;
    _sum: Record<string, number | null>;
    _min: Record<string, number | null>;
    _count: Record<string, number>;
  }>;
}

/** Telemetry writer — never throws (matches AiUsageService's convention): a usage-logging failure must never break the underlying integration call. */
@Injectable()
export class IntegrationApiUsageLogRepository {
  private readonly logger = new Logger(IntegrationApiUsageLogRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateIntegrationApiUsageLogData): Promise<void> {
    try {
      await this.client().create({ data: { ...data } });
    } catch (error) {
      this.logger.error({ err: error, ...data }, 'Failed to record integration API usage log');
    }
  }

  async listByConnection(
    connectionId: string,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{
      id: string;
      action: string;
      statusCode: number | null;
      durationMs: number;
      rateLimitRemaining: number | null;
      retryCount: number;
      error: string | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { connectionId, organizationId: tenant.organizationId };
    const [items, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client().count({ where }),
    ]);
    return { items, total };
  }

  async aggregateForConnection(connectionId: string): Promise<IntegrationUsageAggregate> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { connectionId, organizationId: tenant.organizationId };
    const [aggregate, failedCount] = await Promise.all([
      this.client().aggregate({
        where,
        _avg: { durationMs: true },
        _sum: { retryCount: true },
        _min: { rateLimitRemaining: true },
        _count: { _all: true },
      }),
      this.client().count({ where: { ...where, statusCode: { gte: 400 } } }),
    ]);

    return {
      totalCalls: aggregate._count._all ?? 0,
      failedCalls: failedCount,
      totalRetries: aggregate._sum.retryCount ?? 0,
      averageDurationMs: Math.round(aggregate._avg.durationMs ?? 0),
      minRateLimitRemaining: aggregate._min.rateLimitRemaining ?? null,
    };
  }

  private client(): IntegrationApiUsageLogClient {
    return (
      this.prisma.system as unknown as { integrationApiUsageLog: IntegrationApiUsageLogClient }
    ).integrationApiUsageLog;
  }
}
