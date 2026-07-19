import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KnowledgeDocumentEntity,
  KnowledgeDocumentStatus,
} from '../entities/knowledge-document.entity';

export interface CreateKnowledgeDocumentData {
  sourceId: string;
  externalId?: string;
  title: string;
  contentType: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeDocumentData {
  title?: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
  status?: KnowledgeDocumentStatus;
  indexedAt?: Date | null;
  embeddingsPendingAt?: Date | null;
  error?: string | null;
}

export interface FindKnowledgeDocumentsParams {
  page: number;
  limit: number;
  sourceId?: string;
  status?: KnowledgeDocumentStatus;
}

export interface PaginatedKnowledgeDocuments {
  items: KnowledgeDocumentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface KnowledgeDocumentRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  externalId: string | null;
  title: string;
  contentType: string;
  rawText: string | null;
  metadata: Prisma.JsonValue;
  status: KnowledgeDocumentStatus;
  indexedAt: Date | null;
  embeddingsPendingAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface KnowledgeDocumentClient {
  create(args: { data: Record<string, unknown> }): Promise<KnowledgeDocumentRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<KnowledgeDocumentRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<KnowledgeDocumentRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<KnowledgeDocumentRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

@Injectable()
export class KnowledgeDocumentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocumentEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        sourceId: data.sourceId,
        externalId: data.externalId ?? null,
        title: data.title,
        contentType: data.contentType,
        rawText: data.rawText ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
        status: 'PENDING',
      },
    });

    return toEntity(record);
  }

  async findById(id: string): Promise<KnowledgeDocumentEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });

    return record ? toEntity(record) : null;
  }

  /**
   * Cross-tenant by design: the embedding backfill cron runs with no
   * request context and dispatches per-organization work from this list
   * (each document is then reprocessed *inside* a tenant context for that
   * organization). Returns oldest-pending first so a long backlog drains
   * fairly across ticks.
   */
  async listEmbeddingsPendingSystem(
    limit: number,
  ): Promise<Array<{ id: string; organizationId: string }>> {
    const records = await this.client().findMany({
      where: { embeddingsPendingAt: { not: null }, deletedAt: null, status: 'INDEXED' },
      take: limit,
      orderBy: [{ embeddingsPendingAt: 'asc' }],
    });
    return records.map((record) => ({ id: record.id, organizationId: record.organizationId }));
  }

  /** Used to decide create-vs-update-in-place when re-ingesting the same upstream record. */
  async findBySourceAndExternalId(
    sourceId: string,
    externalId: string,
  ): Promise<KnowledgeDocumentEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { sourceId, externalId, organizationId: tenant.organizationId, deletedAt: null },
    });

    return record ? toEntity(record) : null;
  }

  async findAll(params: FindKnowledgeDocumentsParams): Promise<PaginatedKnowledgeDocuments> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({ where, skip, take: params.limit, orderBy: [{ createdAt: 'desc' }] }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async listBySource(sourceId: string): Promise<KnowledgeDocumentEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { sourceId, organizationId: tenant.organizationId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
    });
    return records.map(toEntity);
  }

  async update(
    id: string,
    data: UpdateKnowledgeDocumentData,
  ): Promise<KnowledgeDocumentEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.rawText !== undefined ? { rawText: data.rawText } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.indexedAt !== undefined ? { indexedAt: data.indexedAt } : {}),
        ...(data.embeddingsPendingAt !== undefined
          ? { embeddingsPendingAt: data.embeddingsPendingAt }
          : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
      },
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<KnowledgeDocumentEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({ where: { id }, data: { deletedAt: new Date() } });
    return toEntity(record);
  }

  async softDeleteBySource(sourceId: string): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.client().updateMany({
      where: { sourceId, organizationId: tenant.organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async countBySource(sourceId: string): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().count({
      where: { sourceId, organizationId: tenant.organizationId, deletedAt: null },
    });
  }

  async countForOrganization(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().count({
      where: { organizationId: tenant.organizationId, deletedAt: null },
    });
  }

  async countByStatusForOrganization(status: KnowledgeDocumentStatus): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().count({
      where: { organizationId: tenant.organizationId, deletedAt: null, status },
    });
  }

  private client(): KnowledgeDocumentClient {
    return (this.prisma.system as unknown as { knowledgeDocument: KnowledgeDocumentClient })
      .knowledgeDocument;
  }
}

function toEntity(record: KnowledgeDocumentRecord): KnowledgeDocumentEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    sourceId: record.sourceId,
    externalId: record.externalId,
    title: record.title,
    contentType: record.contentType,
    rawText: record.rawText,
    metadata: toObject(record.metadata),
    status: record.status,
    indexedAt: record.indexedAt,
    embeddingsPendingAt: record.embeddingsPendingAt,
    error: record.error,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
