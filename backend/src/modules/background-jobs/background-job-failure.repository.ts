import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BackgroundJobFailureEntity } from './entities/background-job-failure.entity';

export interface CreateBackgroundJobFailureData {
  organizationId: string | null;
  queueName: string;
  jobName: string;
  jobId: string | null;
  payload: Record<string, unknown>;
  failureReason: string;
  attemptsMade: number;
}

interface BackgroundJobFailureRecord {
  id: string;
  organizationId: string | null;
  queueName: string;
  jobName: string;
  jobId: string | null;
  payload: Prisma.JsonValue;
  failureReason: string;
  attemptsMade: number;
  createdAt: Date;
}

interface BackgroundJobFailureClient {
  create(args: { data: Record<string, unknown> }): Promise<BackgroundJobFailureRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<BackgroundJobFailureRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

export interface PaginatedBackgroundJobFailures {
  items: BackgroundJobFailureEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Called from two very different contexts: DeadLetterListener (a BullMQ
 * QueueEvents subscriber running entirely outside any HTTP request, no
 * tenant context — writes with an explicit, best-effort-resolved
 * organizationId that may be null) and the read-only ops controller
 * (always within an authenticated request, tenant-scoped).
 */
@Injectable()
export class BackgroundJobFailureRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateBackgroundJobFailureData): Promise<BackgroundJobFailureEntity> {
    const record = await this.client().create({
      data: {
        organizationId: data.organizationId,
        queueName: data.queueName,
        jobName: data.jobName,
        jobId: data.jobId,
        payload: data.payload,
        failureReason: data.failureReason,
        attemptsMade: data.attemptsMade,
      },
    });
    return toEntity(record);
  }

  async findAllForOrganization(
    page: number,
    limit: number,
  ): Promise<PaginatedBackgroundJobFailures> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { organizationId: tenant.organizationId };

    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private client(): BackgroundJobFailureClient {
    return (this.prisma.system as unknown as { backgroundJobFailure: BackgroundJobFailureClient })
      .backgroundJobFailure;
  }
}

function toEntity(record: BackgroundJobFailureRecord): BackgroundJobFailureEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    queueName: record.queueName,
    jobName: record.jobName,
    jobId: record.jobId,
    payload: toObject(record.payload),
    failureReason: record.failureReason,
    attemptsMade: record.attemptsMade,
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
