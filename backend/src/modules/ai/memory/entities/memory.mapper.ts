import { Prisma } from '@prisma/client';
import { MemoryAccessEntity } from './memory-access.entity';
import { MemoryEntity } from './memory.entity';

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

export function toMemoryEntity(record: MemoryRecord): MemoryEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    userId: record.userId,
    conversationId: record.conversationId,
    category: record.category,
    importance: record.importance,
    content: record.content,
    embeddingId: record.embeddingId,
    metadata: toObject(record.metadata),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export function toMemoryAccessEntity(record: MemoryAccessRecord): MemoryAccessEntity {
  return {
    id: record.id,
    memoryId: record.memoryId,
    conversationId: record.conversationId,
    accessedAt: record.accessedAt,
  };
}

export function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
