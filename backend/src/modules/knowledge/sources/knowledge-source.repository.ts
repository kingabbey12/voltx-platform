import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KnowledgeSourceEntity,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
} from '../entities/knowledge-source.entity';

export interface CreateKnowledgeSourceData {
  type: KnowledgeSourceType;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: KnowledgeSourceStatus;
}

export interface UpdateKnowledgeSourceData {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: KnowledgeSourceStatus;
}

export interface FindKnowledgeSourcesParams {
  page: number;
  limit: number;
  type?: KnowledgeSourceType;
  status?: KnowledgeSourceStatus;
}

export interface PaginatedKnowledgeSources {
  items: KnowledgeSourceEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface KnowledgeSourceRecord {
  id: string;
  organizationId: string;
  type: KnowledgeSourceType;
  name: string;
  description: string | null;
  config: Prisma.JsonValue;
  status: KnowledgeSourceStatus;
  lastIndexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface KnowledgeSourceClient {
  create(args: { data: Record<string, unknown> }): Promise<KnowledgeSourceRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<KnowledgeSourceRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<KnowledgeSourceRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<KnowledgeSourceRecord>;
}

@Injectable()
export class KnowledgeSourceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateKnowledgeSourceData): Promise<KnowledgeSourceEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        type: data.type,
        name: data.name,
        description: data.description ?? null,
        config: toJsonValue(data.config) ?? {},
        status: data.status ?? 'ACTIVE',
      },
    });

    return toEntity(record);
  }

  async findById(id: string): Promise<KnowledgeSourceEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });

    return record ? toEntity(record) : null;
  }

  async findAll(params: FindKnowledgeSourcesParams): Promise<PaginatedKnowledgeSources> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.type ? { type: params.type } : {}),
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

  async update(id: string, data: UpdateKnowledgeSourceData): Promise<KnowledgeSourceEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.config !== undefined ? { config: toJsonValue(data.config) ?? {} } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    return toEntity(record);
  }

  async markIndexed(id: string): Promise<void> {
    await this.client().update({ where: { id }, data: { lastIndexedAt: new Date() } });
  }

  async softDelete(id: string): Promise<KnowledgeSourceEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({ where: { id }, data: { deletedAt: new Date() } });
    return toEntity(record);
  }

  async countForOrganization(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().count({
      where: { organizationId: tenant.organizationId, deletedAt: null },
    });
  }

  private client(): KnowledgeSourceClient {
    return (this.prisma.system as unknown as { knowledgeSource: KnowledgeSourceClient })
      .knowledgeSource;
  }
}

function toEntity(record: KnowledgeSourceRecord): KnowledgeSourceEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    type: record.type,
    name: record.name,
    description: record.description,
    config: toObject(record.config),
    status: record.status,
    lastIndexedAt: record.lastIndexedAt,
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
