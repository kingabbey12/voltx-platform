import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KnowledgeIngestionJobEntity,
  KnowledgeJobStage,
  KnowledgeJobStatus,
  KnowledgeJobType,
  toKnowledgeIngestionJobEntity,
} from '../entities/knowledge-ingestion-job.entity';

export interface CreateKnowledgeIngestionJobData {
  type: KnowledgeJobType;
  documentId?: string | null;
  sourceId?: string | null;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
  createdByUserId: string | null;
  createdByMembershipId: string | null;
}

export interface FindKnowledgeIngestionJobsParams {
  page: number;
  limit: number;
  status?: KnowledgeJobStatus;
  type?: KnowledgeJobType;
}

export interface PaginatedKnowledgeIngestionJobs {
  items: KnowledgeIngestionJobEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Persistence for ingestion jobs. `findByIdUnscoped` is deliberately not
 * tenant-scoped: the BullMQ worker runs outside any HTTP/tenant context and
 * needs to load a job by id to reconstruct that context from the row itself.
 * Every other read is org-scoped.
 */
@Injectable()
export class KnowledgeIngestionJobRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get jobs() {
    return this.prisma.system.knowledgeIngestionJob;
  }

  async create(data: CreateKnowledgeIngestionJobData): Promise<KnowledgeIngestionJobEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.jobs.create({
      data: {
        organizationId: tenant.organizationId,
        type: data.type,
        documentId: data.documentId ?? null,
        sourceId: data.sourceId ?? null,
        maxAttempts: data.maxAttempts ?? 3,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId,
        createdByMembershipId: data.createdByMembershipId,
      },
    });
    return toKnowledgeIngestionJobEntity(record);
  }

  async findById(id: string): Promise<KnowledgeIngestionJobEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.jobs.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toKnowledgeIngestionJobEntity(record) : null;
  }

  /** Not tenant-scoped — used only by the queue worker to rehydrate context. */
  async findByIdUnscoped(id: string): Promise<KnowledgeIngestionJobEntity | null> {
    const record = await this.jobs.findUnique({ where: { id } });
    return record ? toKnowledgeIngestionJobEntity(record) : null;
  }

  async findAll(
    params: FindKnowledgeIngestionJobsParams,
  ): Promise<PaginatedKnowledgeIngestionJobs> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Prisma.KnowledgeIngestionJobWhereInput = {
      organizationId: tenant.organizationId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type } : {}),
    };
    const [records, total] = await Promise.all([
      this.jobs.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.jobs.count({ where }),
    ]);
    return {
      items: records.map(toKnowledgeIngestionJobEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async markRunning(id: string): Promise<void> {
    await this.jobs.update({
      where: { id },
      data: {
        status: 'RUNNING',
        stage: 'PARSING',
        startedAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    });
  }

  async updateProgress(id: string, stage: KnowledgeJobStage, progress: number): Promise<void> {
    await this.jobs.update({
      where: { id },
      data: { stage, progress: Math.max(0, Math.min(100, Math.round(progress))) },
    });
  }

  async markCompleted(id: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.jobs.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        stage: 'DONE',
        progress: 100,
        completedAt: new Date(),
        error: null,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.jobs.update({
      where: { id },
      data: { status: 'FAILED', error, completedAt: new Date() },
    });
  }
}
