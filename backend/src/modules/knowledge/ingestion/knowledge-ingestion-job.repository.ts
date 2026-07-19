import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KnowledgeIngestionJobEntity,
  KnowledgeIngestionJobStatus,
} from '../entities/knowledge-ingestion-job.entity';

export interface CreateKnowledgeIngestionJobData {
  sourceId: string;
  documentId?: string | null;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  resumeFromJobId?: string | null;
}

export interface PaginatedKnowledgeIngestionJobs {
  items: KnowledgeIngestionJobEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface KnowledgeIngestionJobRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  documentId: string | null;
  requestedByUserId: string;
  requestedByMembershipId: string;
  status: KnowledgeIngestionJobStatus;
  progressPercent: number;
  attemptsMade: number;
  maxAttempts: number;
  payload: Prisma.JsonValue;
  resumeFromJobId: string | null;
  cancellationRequestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeIngestionJobClient {
  create(args: { data: Record<string, unknown> }): Promise<KnowledgeIngestionJobRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<KnowledgeIngestionJobRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<KnowledgeIngestionJobRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<KnowledgeIngestionJobRecord>;
}

@Injectable()
export class KnowledgeIngestionJobRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createQueued(data: CreateKnowledgeIngestionJobData): Promise<KnowledgeIngestionJobEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const created = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        sourceId: data.sourceId,
        documentId: data.documentId ?? null,
        requestedByUserId: tenant.userId,
        requestedByMembershipId: tenant.membershipId ?? tenant.userId,
        status: 'QUEUED',
        progressPercent: 5,
        attemptsMade: 0,
        maxAttempts: data.maxAttempts ?? 5,
        payload: data.payload,
        resumeFromJobId: data.resumeFromJobId ?? null,
      },
    });

    return toEntity(created);
  }

  async findById(id: string): Promise<KnowledgeIngestionJobEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });

    return record ? toEntity(record) : null;
  }

  async findByIdSystem(id: string): Promise<KnowledgeIngestionJobEntity | null> {
    const record = await this.client().findFirst({ where: { id } });
    return record ? toEntity(record) : null;
  }

  async listForCurrentOrganization(params: {
    page: number;
    limit: number;
    status?: KnowledgeIngestionJobStatus;
  }): Promise<PaginatedKnowledgeIngestionJobs> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = {
      organizationId: tenant.organizationId,
      ...(params.status ? { status: params.status } : {}),
    };
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      this.client().findMany({ where, skip, take: params.limit, orderBy: [{ createdAt: 'desc' }] }),
      this.client().count({ where }),
    ]);

    return {
      items: items.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async listFailuresForCurrentOrganization(
    page: number,
    limit: number,
  ): Promise<PaginatedKnowledgeIngestionJobs> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = {
      organizationId: tenant.organizationId,
      status: { in: ['FAILED', 'CANCELLED'] as KnowledgeIngestionJobStatus[] },
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.client().findMany({ where, skip, take: limit, orderBy: [{ createdAt: 'desc' }] }),
      this.client().count({ where }),
    ]);

    return {
      items: items.map(toEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async markCancellationRequested(id: string): Promise<KnowledgeIngestionJobEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated = await this.client().update({
      where: { id },
      data: { cancellationRequestedAt: new Date() },
    });

    return toEntity(updated);
  }

  async updateSystem(
    id: string,
    data: {
      status?: KnowledgeIngestionJobStatus;
      progressPercent?: number;
      attemptsMade?: number;
      documentId?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
      lastError?: string | null;
    },
  ): Promise<void> {
    await this.client().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.progressPercent !== undefined ? { progressPercent: data.progressPercent } : {}),
        ...(data.attemptsMade !== undefined ? { attemptsMade: data.attemptsMade } : {}),
        ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
      },
    });
  }

  private client(): KnowledgeIngestionJobClient {
    return (this.prisma.system as unknown as { knowledgeIngestionJob: KnowledgeIngestionJobClient })
      .knowledgeIngestionJob;
  }
}

function toEntity(record: KnowledgeIngestionJobRecord): KnowledgeIngestionJobEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    sourceId: record.sourceId,
    documentId: record.documentId,
    requestedByUserId: record.requestedByUserId,
    requestedByMembershipId: record.requestedByMembershipId,
    status: record.status,
    progressPercent: record.progressPercent,
    attemptsMade: record.attemptsMade,
    maxAttempts: record.maxAttempts,
    payload: toObject(record.payload),
    resumeFromJobId: record.resumeFromJobId,
    cancellationRequestedAt: record.cancellationRequestedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
