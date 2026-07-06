import { Injectable } from '@nestjs/common';
import { CreateKnowledgeEntityData, KnowledgeGraphRepository } from './knowledge-graph.repository';
import {
  GraphTraversalNode,
  KnowledgeEntityRecord,
  KnowledgeEntityType,
  KnowledgeRelationshipType,
} from '../entities/knowledge-graph.entity';

export interface LinkEntitiesInput {
  from: { type: KnowledgeEntityType; externalId?: string; label: string };
  to: { type: KnowledgeEntityType; externalId?: string; label: string };
  relationship: KnowledgeRelationshipType;
}

/**
 * Thin service over KnowledgeGraphRepository: owns the "link two things
 * together" workflow (upsert both entities, then the edge) so callers
 * (ingestion, admin APIs, retrieval enrichment) never have to sequence
 * entity-then-relationship creation themselves.
 */
@Injectable()
export class KnowledgeGraphService {
  constructor(private readonly knowledgeGraphRepository: KnowledgeGraphRepository) {}

  async upsertEntity(data: CreateKnowledgeEntityData): Promise<KnowledgeEntityRecord> {
    return this.knowledgeGraphRepository.upsertEntity(data);
  }

  async linkEntities(input: LinkEntitiesInput): Promise<void> {
    const fromEntity = await this.knowledgeGraphRepository.upsertEntity(input.from);
    const toEntity = await this.knowledgeGraphRepository.upsertEntity(input.to);

    await this.knowledgeGraphRepository.createRelationship({
      fromEntityId: fromEntity.id,
      toEntityId: toEntity.id,
      type: input.relationship,
    });
  }

  async traverse(entityId: string, maxHops: number): Promise<GraphTraversalNode[]> {
    return this.knowledgeGraphRepository.traverse(entityId, maxHops);
  }

  async traverseByExternalId(
    type: KnowledgeEntityType,
    externalId: string,
    maxHops: number,
  ): Promise<GraphTraversalNode[]> {
    const entity = await this.knowledgeGraphRepository.findByExternalId(type, externalId);
    if (!entity) {
      return [];
    }
    return this.knowledgeGraphRepository.traverse(entity.id, maxHops);
  }

  /**
   * Renders a short "related entities" summary for a document's external
   * record (e.g. a CRM contact) — used by retrieval to enrich a result
   * with graph context without every caller needing to know the graph
   * schema. Returns an empty string when the record isn't represented in
   * the graph or has no neighbors within maxHops.
   */
  async describeRelatedContext(
    type: KnowledgeEntityType,
    externalId: string,
    maxHops: number,
  ): Promise<string> {
    const entity = await this.knowledgeGraphRepository.findByExternalId(type, externalId);
    if (!entity) {
      return '';
    }

    const nodes = await this.knowledgeGraphRepository.traverse(entity.id, maxHops);
    const related = nodes.filter((node) => node.depth > 0);
    if (related.length === 0) {
      return '';
    }

    return related
      .map(
        (node) =>
          `${node.viaRelationship ?? 'RELATED_TO'}: ${node.entity.label} (${node.entity.type})`,
      )
      .join('; ');
  }

  async stats(): Promise<{ entityCount: number; relationshipCount: number }> {
    const [entityCount, relationshipCount] = await Promise.all([
      this.knowledgeGraphRepository.countEntitiesForOrganization(),
      this.knowledgeGraphRepository.countRelationshipsForOrganization(),
    ]);
    return { entityCount, relationshipCount };
  }
}
