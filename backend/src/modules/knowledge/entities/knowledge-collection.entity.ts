export type KnowledgeCollectionStatus = 'ACTIVE' | 'ARCHIVED';

export interface KnowledgeCollectionEntity {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  status: KnowledgeCollectionStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface KnowledgeCollectionRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  tags: string[];
  metadata: unknown;
  status: KnowledgeCollectionStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function toKnowledgeCollectionEntity(
  record: KnowledgeCollectionRecord,
): KnowledgeCollectionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    tags: record.tags,
    metadata:
      typeof record.metadata === 'object' &&
      record.metadata !== null &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
    status: record.status,
    createdByUserId: record.createdByUserId,
    updatedByUserId: record.updatedByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
