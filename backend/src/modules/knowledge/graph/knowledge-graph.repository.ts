import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  GraphTraversalNode,
  KnowledgeEntityRecord,
  KnowledgeEntityType,
  KnowledgeRelationshipEntity,
  KnowledgeRelationshipType,
} from '../entities/knowledge-graph.entity';

export interface CreateKnowledgeEntityData {
  type: KnowledgeEntityType;
  externalId?: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeRelationshipData {
  fromEntityId: string;
  toEntityId: string;
  type: KnowledgeRelationshipType;
  metadata?: Record<string, unknown>;
}

interface KnowledgeEntityRow {
  id: string;
  organization_id: string;
  type: KnowledgeEntityType;
  external_id: string | null;
  label: string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface KnowledgeRelationshipRow {
  id: string;
  organization_id: string;
  from_entity_id: string;
  to_entity_id: string;
  type: KnowledgeRelationshipType;
  metadata: unknown;
  created_at: Date;
}

/**
 * Owns KnowledgeEntity/KnowledgeRelationship persistence and graph
 * traversal. Traversal is a breadth-first walk implemented in application
 * code (bounded by maxHops) rather than a recursive CTE — the graph is
 * expected to be shallow (a handful of hops around a CRM record), so a
 * simple BFS is both simpler to reason about and easier to test than
 * recursive SQL, at negligible cost for this scale.
 */
@Injectable()
export class KnowledgeGraphRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async upsertEntity(data: CreateKnowledgeEntityData): Promise<KnowledgeEntityRecord> {
    const tenant = this.tenantContextService.getOrThrow();

    if (data.externalId) {
      const existing = await this.findByExternalId(data.type, data.externalId);
      if (existing) {
        const [updated] = await this.prisma.system.$queryRaw<KnowledgeEntityRow[]>`
          UPDATE knowledge_entities
          SET label = ${data.label}, metadata = ${JSON.stringify(data.metadata ?? {})}::jsonb, updated_at = now()
          WHERE id = ${existing.id}::uuid
          RETURNING id, organization_id, type, external_id, label, metadata, created_at, updated_at, deleted_at
        `;
        return toEntityRecord(updated);
      }
    }

    const [created] = await this.prisma.system.$queryRaw<KnowledgeEntityRow[]>`
      INSERT INTO knowledge_entities (id, organization_id, type, external_id, label, metadata, created_at, updated_at)
      VALUES (gen_random_uuid(), ${tenant.organizationId}::uuid, ${data.type}::"KnowledgeEntityType", ${data.externalId ?? null}, ${data.label}, ${JSON.stringify(data.metadata ?? {})}::jsonb, now(), now())
      RETURNING id, organization_id, type, external_id, label, metadata, created_at, updated_at, deleted_at
    `;
    return toEntityRecord(created);
  }

  async findByExternalId(
    type: KnowledgeEntityType,
    externalId: string,
  ): Promise<KnowledgeEntityRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<KnowledgeEntityRow[]>`
      SELECT id, organization_id, type, external_id, label, metadata, created_at, updated_at, deleted_at
      FROM knowledge_entities
      WHERE organization_id = ${tenant.organizationId}::uuid
        AND type = ${type}::"KnowledgeEntityType"
        AND external_id = ${externalId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? toEntityRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<KnowledgeEntityRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<KnowledgeEntityRow[]>`
      SELECT id, organization_id, type, external_id, label, metadata, created_at, updated_at, deleted_at
      FROM knowledge_entities
      WHERE id = ${id}::uuid AND organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
    `;
    return rows[0] ? toEntityRecord(rows[0]) : null;
  }

  async createRelationship(
    data: CreateKnowledgeRelationshipData,
  ): Promise<KnowledgeRelationshipEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const [created] = await this.prisma.system.$queryRaw<KnowledgeRelationshipRow[]>`
      INSERT INTO knowledge_relationships (id, organization_id, from_entity_id, to_entity_id, type, metadata, created_at)
      VALUES (gen_random_uuid(), ${tenant.organizationId}::uuid, ${data.fromEntityId}::uuid, ${data.toEntityId}::uuid, ${data.type}::"KnowledgeRelationshipType", ${JSON.stringify(data.metadata ?? {})}::jsonb, now())
      RETURNING id, organization_id, from_entity_id, to_entity_id, type, metadata, created_at
    `;
    return toRelationshipEntity(created);
  }

  /**
   * Breadth-first traversal outward from `startEntityId` up to `maxHops`,
   * following relationships in either direction. Returns each discovered
   * entity once, at its shortest-path depth.
   */
  async traverse(startEntityId: string, maxHops: number): Promise<GraphTraversalNode[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const visited = new Map<string, GraphTraversalNode>();
    let frontier = [startEntityId];
    let depth = 0;

    const start = await this.findById(startEntityId);
    if (!start) {
      return [];
    }
    visited.set(startEntityId, { entity: start, depth: 0, viaRelationship: null });

    while (frontier.length > 0 && depth < maxHops) {
      depth += 1;
      const edges = await this.prisma.system.$queryRaw<
        Array<KnowledgeRelationshipRow & { neighbor_id: string }>
      >`
        SELECT id, organization_id, from_entity_id, to_entity_id, type, metadata, created_at,
          CASE WHEN from_entity_id = ANY(${frontier}::uuid[]) THEN to_entity_id ELSE from_entity_id END AS neighbor_id
        FROM knowledge_relationships
        WHERE organization_id = ${tenant.organizationId}::uuid
          AND (from_entity_id = ANY(${frontier}::uuid[]) OR to_entity_id = ANY(${frontier}::uuid[]))
      `;

      const nextFrontier: string[] = [];
      for (const edge of edges) {
        if (visited.has(edge.neighbor_id)) {
          continue;
        }
        const neighbor = await this.findById(edge.neighbor_id);
        if (!neighbor) {
          continue;
        }
        visited.set(edge.neighbor_id, { entity: neighbor, depth, viaRelationship: edge.type });
        nextFrontier.push(edge.neighbor_id);
      }
      frontier = nextFrontier;
    }

    return Array.from(visited.values());
  }

  async softDeleteEntity(id: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.prisma.system.$executeRaw`
      UPDATE knowledge_entities SET deleted_at = now()
      WHERE id = ${id}::uuid AND organization_id = ${tenant.organizationId}::uuid
    `;
  }

  async countEntitiesForOrganization(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const [{ count }] = await this.prisma.system.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM knowledge_entities
      WHERE organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
    `;
    return Number(count);
  }

  async countRelationshipsForOrganization(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const [{ count }] = await this.prisma.system.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM knowledge_relationships
      WHERE organization_id = ${tenant.organizationId}::uuid
    `;
    return Number(count);
  }
}

function toEntityRecord(row: KnowledgeEntityRow): KnowledgeEntityRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    externalId: row.external_id,
    label: row.label,
    metadata: toObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toRelationshipEntity(row: KnowledgeRelationshipRow): KnowledgeRelationshipEntity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    type: row.type,
    metadata: toObject(row.metadata),
    createdAt: row.created_at,
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
