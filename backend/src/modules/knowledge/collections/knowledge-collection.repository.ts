import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KnowledgeCollectionEntity,
  KnowledgeCollectionStatus,
  toKnowledgeCollectionEntity,
} from '../entities/knowledge-collection.entity';

export interface CreateKnowledgeCollectionData {
  name: string;
  description: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
}

export interface UpdateKnowledgeCollectionData {
  name?: string;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: KnowledgeCollectionStatus;
  updatedByUserId?: string | null;
}

export interface FindKnowledgeCollectionsParams {
  page: number;
  limit: number;
  status?: KnowledgeCollectionStatus;
}

export interface PaginatedKnowledgeCollections {
  items: KnowledgeCollectionEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Tenant-scoped persistence for knowledge collections. */
@Injectable()
export class KnowledgeCollectionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get collections() {
    return this.prisma.system.knowledgeCollection;
  }

  async create(data: CreateKnowledgeCollectionData): Promise<KnowledgeCollectionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.collections.create({
      data: {
        organizationId: tenant.organizationId,
        name: data.name,
        description: data.description,
        tags: data.tags,
        metadata: data.metadata as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId,
        updatedByUserId: data.createdByUserId,
      },
    });
    return toKnowledgeCollectionEntity(record);
  }

  async findById(id: string): Promise<KnowledgeCollectionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.collections.findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toKnowledgeCollectionEntity(record) : null;
  }

  async nameExists(name: string): Promise<boolean> {
    const tenant = this.tenantContextService.getOrThrow();
    const count = await this.collections.count({
      where: { organizationId: tenant.organizationId, name, deletedAt: null },
    });
    return count > 0;
  }

  async findAll(params: FindKnowledgeCollectionsParams): Promise<PaginatedKnowledgeCollections> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Prisma.KnowledgeCollectionWhereInput = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
    };
    const [records, total] = await Promise.all([
      this.collections.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.collections.count({ where }),
    ]);
    return {
      items: records.map(toKnowledgeCollectionEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async update(
    id: string,
    data: UpdateKnowledgeCollectionData,
  ): Promise<KnowledgeCollectionEntity> {
    const record = await this.collections.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.updatedByUserId !== undefined ? { updatedByUserId: data.updatedByUserId } : {}),
      },
    });
    return toKnowledgeCollectionEntity(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.collections.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
