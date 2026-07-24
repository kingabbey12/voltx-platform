import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  CreateKnowledgeCollectionDto,
  ListKnowledgeCollectionsQueryDto,
  UpdateKnowledgeCollectionDto,
} from '../dto/knowledge-collection.dto';
import { KnowledgeCollectionEntity } from '../entities/knowledge-collection.entity';
import {
  KnowledgeCollectionRepository,
  PaginatedKnowledgeCollections,
} from './knowledge-collection.repository';

const RESOURCE = 'knowledge_collection';

/**
 * Business logic for knowledge collections: tenant-scoped CRUD with a unique
 * per-org name, soft delete, and audit on every mutation. Collections group
 * documents for retrieval (a "collection filter") — deleting one detaches its
 * documents (FK ON DELETE SET NULL) rather than removing their content.
 */
@Injectable()
export class KnowledgeCollectionService {
  constructor(
    private readonly repository: KnowledgeCollectionRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(dto: CreateKnowledgeCollectionDto): Promise<KnowledgeCollectionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const name = dto.name.trim();
    if (await this.repository.nameExists(name)) {
      throw new ConflictException(`A collection named "${name}" already exists.`);
    }
    const collection = await this.repository.create({
      name,
      description: dto.description?.trim() || null,
      tags: dto.tags ?? [],
      metadata: dto.metadata ?? {},
      createdByUserId: tenant.userId ?? null,
    });
    await this.audit('knowledge.collection.created', collection.id, { name });
    return collection;
  }

  async list(query: ListKnowledgeCollectionsQueryDto): Promise<PaginatedKnowledgeCollections> {
    return this.repository.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  async get(id: string): Promise<KnowledgeCollectionEntity> {
    return this.getOrThrow(id);
  }

  async update(id: string, dto: UpdateKnowledgeCollectionDto): Promise<KnowledgeCollectionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.getOrThrow(id);

    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      if (await this.repository.nameExists(dto.name.trim())) {
        throw new ConflictException(`A collection named "${dto.name.trim()}" already exists.`);
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updatedByUserId: tenant.userId ?? null,
    });
    await this.audit('knowledge.collection.updated', id, { fields: Object.keys(dto) });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getOrThrow(id);
    await this.repository.softDelete(id);
    await this.audit('knowledge.collection.deleted', id, { name: existing.name });
  }

  private async getOrThrow(id: string): Promise<KnowledgeCollectionEntity> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new NotFoundException('Knowledge collection not found');
    }
    return collection;
  }

  private async audit(
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({ action, resource: RESOURCE, resourceId, metadata });
  }
}
