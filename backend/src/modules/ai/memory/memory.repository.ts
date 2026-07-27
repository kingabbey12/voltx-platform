import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { toJsonValue, toMemoryAccessEntity, toMemoryEntity } from './entities/memory.mapper';
import { MemoryAccessEntity } from './entities/memory-access.entity';
import { MemoryEntity } from './entities/memory.entity';

export interface CreateMemoryData {
  conversationId: string;
  category: string;
  importance: number;
  content: string;
  embeddingId?: string;
  metadata?: Record<string, unknown>;
}

export interface ListMemoriesParams {
  page: number;
  limit: number;
  category?: string;
  conversationId?: string;
}

export interface PaginatedMemories {
  items: MemoryEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MemoryRecord {
  id: string;
  organizationId: string;
  userId: string;
  conversationId: string;
  category: string;
  importance: number;
  content: string;
  embeddingId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MemoryAccessRecord {
  id: string;
  memoryId: string;
  conversationId: string;
  accessedAt: Date;
}

interface ConversationLookupRecord {
  id: string;
}

interface MemoryClient {
  create(args: {
    data: {
      organizationId: string;
      userId: string;
      conversationId: string;
      category: string;
      importance: number;
      content: string;
      embeddingId?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<MemoryRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<MemoryRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>> | Record<string, 'asc' | 'desc'>;
  }): Promise<MemoryRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<MemoryRecord>;
}

interface MemoryAccessClient {
  create(args: {
    data: {
      memoryId: string;
      conversationId: string;
      accessedAt?: Date;
    };
  }): Promise<MemoryAccessRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, 'asc' | 'desc'>;
  }): Promise<MemoryAccessRecord[]>;
}

interface ConversationClient {
  findFirst(args: { where: Record<string, unknown> }): Promise<ConversationLookupRecord | null>;
}

@Injectable()
export class MemoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createMemory(data: CreateMemoryData): Promise<MemoryEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.memories().create({
      data: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        conversationId: data.conversationId,
        category: data.category,
        importance: data.importance,
        content: data.content,
        embeddingId: data.embeddingId ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });

    return toMemoryEntity(record);
  }

  async findMemoryById(id: string): Promise<MemoryEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.memories().findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        deletedAt: null,
      },
    });

    return record ? toMemoryEntity(record) : null;
  }

  async listMemories(params: ListMemoriesParams): Promise<PaginatedMemories> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      deletedAt: null,
      ...(params.category ? { category: params.category } : {}),
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    };

    const [records, total] = await Promise.all([
      this.memories().findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.memories().count({ where }),
    ]);

    return {
      items: records.map(toMemoryEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  /** Tenant-scoped metadata update (belief layer); null when out of scope. */
  async updateMemoryMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<MemoryEntity | null> {
    const existing = await this.findMemoryById(id);
    if (!existing) {
      return null;
    }

    const record = await this.memories().update({
      where: { id },
      data: { metadata: toJsonValue(metadata) ?? {} },
    });

    return toMemoryEntity(record);
  }

  async softDeleteMemory(id: string): Promise<MemoryEntity | null> {
    const existing = await this.findMemoryById(id);
    if (!existing) {
      return null;
    }

    const record = await this.memories().update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toMemoryEntity(record);
  }

  /** Persists a memory's content embedding — see Memory.embedding's schema doc comment. Raw SQL: pgvector's column type is Unsupported in the Prisma client, same reason KnowledgeChunkRepository is all raw SQL. */
  async saveEmbedding(memoryId: string, embedding: number[]): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.prisma.system.$executeRaw`
      UPDATE memories
      SET embedding = ${toVectorLiteral(embedding)}::vector
      WHERE id = ${memoryId}::uuid AND organization_id = ${tenant.organizationId}::uuid
    `;
  }

  /**
   * One indexed PK lookup per candidate memory scored — bounded by
   * MemorySelector's DEFAULT_CANDIDATE_LIMIT (50), each a cheap primary-key
   * read. Not batched into one query today; revisit if candidate volume
   * grows enough for that N+1 to matter in practice.
   */
  async getEmbeddingForMemory(memoryId: string): Promise<number[] | null> {
    const rows = await this.prisma.system.$queryRaw<Array<{ embedding: string | null }>>`
      SELECT embedding::text AS embedding FROM memories WHERE id = ${memoryId}::uuid
    `;
    const raw = rows[0]?.embedding;
    return raw ? parseVectorLiteral(raw) : null;
  }

  async listSelectionCandidates(limit: number): Promise<MemoryEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.memories().findMany({
      where: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        deletedAt: null,
      },
      take: limit,
      orderBy: [{ updatedAt: 'desc' }, { importance: 'desc' }],
    });

    return records.map(toMemoryEntity);
  }

  async listAccessesForMemories(memoryIds: string[]): Promise<MemoryAccessEntity[]> {
    if (memoryIds.length === 0) {
      return [];
    }

    const records = await this.memoryAccesses().findMany({
      where: {
        memoryId: {
          in: memoryIds,
        },
      },
      orderBy: { accessedAt: 'desc' },
    });

    return records.map(toMemoryAccessEntity);
  }

  async recordMemoryAccesses(memoryIds: string[], conversationId: string): Promise<void> {
    await Promise.all(
      memoryIds.map((memoryId) =>
        this.memoryAccesses().create({
          data: {
            memoryId,
            conversationId,
          },
        }),
      ),
    );
  }

  async countActiveMemories(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.memories().count({
      where: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        deletedAt: null,
      },
    });
  }

  async listPrunableMemories(limit: number): Promise<MemoryEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.memories().findMany({
      where: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        deletedAt: null,
      },
      take: limit,
      orderBy: [{ importance: 'asc' }, { updatedAt: 'asc' }],
    });

    return records.map(toMemoryEntity);
  }

  async conversationExists(conversationId: string): Promise<boolean> {
    const tenant = this.tenantContextService.getOrThrow();
    const conversation = await this.conversations().findFirst({
      where: {
        id: conversationId,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        deletedAt: null,
      },
    });

    return Boolean(conversation);
  }

  private memories(): MemoryClient {
    return (this.prisma.system as unknown as { memory: MemoryClient }).memory;
  }

  private memoryAccesses(): MemoryAccessClient {
    return (this.prisma.system as unknown as { memoryAccess: MemoryAccessClient }).memoryAccess;
  }

  private conversations(): ConversationClient {
    return (this.prisma.system as unknown as { conversation: ConversationClient }).conversation;
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function parseVectorLiteral(literal: string): number[] {
  return literal
    .slice(1, -1)
    .split(',')
    .filter((part) => part.length > 0)
    .map(Number);
}
