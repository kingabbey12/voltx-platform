import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  KeywordSearchHit,
  KnowledgeChunkEntity,
  SemanticSearchHit,
} from '../entities/knowledge-chunk.entity';

export interface CreateKnowledgeChunkInput {
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  embeddingModel?: string | null;
  embeddingProvider?: string | null;
  embeddingDimensions?: number | null;
  embeddingChecksum?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchFilters {
  sourceIds?: string[];
  sourceTypes?: string[];
  documentIds?: string[];
  /** Scopes to one or more KnowledgeCollections via knowledge_documents.collection_id — the AI Agent builder's "Knowledge collection selection" field. */
  collectionIds?: string[];
}

interface RawChunkRow {
  id: string;
  organization_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: unknown;
  created_at: Date;
  deleted_at: Date | null;
  document_title: string;
  document_content_type: string;
  source_id: string;
  source_type: string;
  source_name: string;
  external_id: string | null;
}

interface RawSemanticRow extends RawChunkRow {
  similarity: number;
}

interface RawKeywordRow extends RawChunkRow {
  rank: number;
}

const CHUNK_CONTEXT_COLUMNS = Prisma.sql`
  c.id,
  c.organization_id,
  c.document_id,
  c.chunk_index,
  c.content,
  c.token_count,
  c.metadata,
  c.created_at,
  c.deleted_at,
  d.title AS document_title,
  d.content_type AS document_content_type,
  s.id AS source_id,
  s.type AS source_type,
  s.name AS source_name,
  d.external_id AS external_id
`;

const CHUNK_CONTEXT_JOIN = Prisma.sql`
  FROM knowledge_chunks c
  INNER JOIN knowledge_documents d ON d.id = c.document_id
  INNER JOIN knowledge_sources s ON s.id = d.source_id
`;

/**
 * Owns all reads/writes to the pgvector `embedding` column and the
 * generated `content_tsv` full-text column — both are `Unsupported` types
 * in the Prisma schema, so every operation here goes through raw SQL
 * ($queryRaw/$executeRaw with Prisma.sql tagged templates, never string
 * concatenation, to stay injection-safe).
 */
@Injectable()
export class KnowledgeChunkRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createMany(chunks: CreateKnowledgeChunkInput[]): Promise<KnowledgeChunkEntity[]> {
    if (chunks.length === 0) {
      return [];
    }

    const tenant = this.tenantContextService.getOrThrow();
    const now = new Date();
    const rows = chunks.map((chunk) => {
      const id = randomUUID();
      return {
        id,
        row: Prisma.sql`(
          ${id}::uuid,
          ${tenant.organizationId}::uuid,
          ${chunk.documentId}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${chunk.tokenCount},
          ${toVectorLiteral(chunk.embedding)}::vector,
          ${chunk.embeddingModel ?? null},
          ${chunk.embeddingProvider ?? null},
          ${chunk.embeddingDimensions ?? null},
          ${chunk.embeddingChecksum ?? null},
          ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
          ${now}
        )`,
      };
    });

    await this.prisma.system.$executeRaw`
      INSERT INTO knowledge_chunks
        (id, organization_id, document_id, chunk_index, content, token_count, embedding,
         embedding_model, embedding_provider, embedding_dimensions, embedding_checksum, metadata, created_at)
      VALUES ${Prisma.join(rows.map((r) => r.row))}
    `;

    const ids = rows.map((r) => r.id);
    const created = await this.prisma.system.$queryRaw<
      Array<{
        id: string;
        organization_id: string;
        document_id: string;
        chunk_index: number;
        content: string;
        token_count: number;
        metadata: unknown;
        created_at: Date;
        deleted_at: Date | null;
      }>
    >`
      SELECT id, organization_id, document_id, chunk_index, content, token_count, metadata, created_at, deleted_at
      FROM knowledge_chunks
      WHERE id = ANY(${ids}::uuid[])
      ORDER BY chunk_index ASC
    `;

    return created.map(toEntity);
  }

  async deleteByDocument(documentId: string): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.prisma.system.$executeRaw`
      UPDATE knowledge_chunks
      SET deleted_at = now()
      WHERE document_id = ${documentId}::uuid
        AND organization_id = ${tenant.organizationId}::uuid
        AND deleted_at IS NULL
    `;
    return Number(result);
  }

  /**
   * Returns already-stored embeddings for the given content checksums (scoped
   * to the org + embedding model), so ingestion can reuse an identical chunk's
   * vector instead of paying for a duplicate embedding call. Reads the vector
   * back as text and parses it — pgvector renders as "[a,b,c]".
   */
  async findEmbeddingsByChecksum(
    checksums: string[],
    model: string,
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (checksums.length === 0) {
      return result;
    }
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<
      Array<{ embedding_checksum: string; embedding: string }>
    >`
      SELECT DISTINCT ON (embedding_checksum) embedding_checksum, embedding::text AS embedding
      FROM knowledge_chunks
      WHERE organization_id = ${tenant.organizationId}::uuid
        AND embedding_model = ${model}
        AND embedding_checksum = ANY(${checksums}::text[])
        AND embedding IS NOT NULL
        AND deleted_at IS NULL
    `;
    for (const row of rows) {
      result.set(row.embedding_checksum, parseVectorLiteral(row.embedding));
    }
    return result;
  }

  async countForOrganization(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const [{ count }] = await this.prisma.system.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM knowledge_chunks
      WHERE organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
    `;
    return Number(count);
  }

  async semanticSearch(
    queryEmbedding: number[],
    limit: number,
    filters: KnowledgeSearchFilters = {},
  ): Promise<SemanticSearchHit[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const vectorLiteral = toVectorLiteral(queryEmbedding);
    const filterClause = buildFilterClause(filters);

    const rows = await this.prisma.system.$queryRaw<RawSemanticRow[]>`
      SELECT
        ${CHUNK_CONTEXT_COLUMNS},
        1 - (c.embedding <=> ${vectorLiteral}::vector) AS similarity
      ${CHUNK_CONTEXT_JOIN}
      WHERE c.organization_id = ${tenant.organizationId}::uuid
        AND c.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND c.embedding IS NOT NULL
        ${filterClause}
      ORDER BY c.embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ ...toContextEntity(row), similarity: Number(row.similarity) }));
  }

  async keywordSearch(
    query: string,
    limit: number,
    filters: KnowledgeSearchFilters = {},
  ): Promise<KeywordSearchHit[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const filterClause = buildFilterClause(filters);

    const rows = await this.prisma.system.$queryRaw<RawKeywordRow[]>`
      SELECT
        ${CHUNK_CONTEXT_COLUMNS},
        ts_rank(c.content_tsv, plainto_tsquery('english', ${query})) AS rank
      ${CHUNK_CONTEXT_JOIN}
      WHERE c.organization_id = ${tenant.organizationId}::uuid
        AND c.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND c.content_tsv @@ plainto_tsquery('english', ${query})
        ${filterClause}
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ ...toContextEntity(row), rank: Number(row.rank) }));
  }
}

function buildFilterClause(filters: KnowledgeSearchFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    clauses.push(Prisma.sql`s.id = ANY(${filters.sourceIds}::uuid[])`);
  }
  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    clauses.push(Prisma.sql`s.type::text = ANY(${filters.sourceTypes}::text[])`);
  }
  if (filters.documentIds && filters.documentIds.length > 0) {
    clauses.push(Prisma.sql`d.id = ANY(${filters.documentIds}::uuid[])`);
  }
  if (filters.collectionIds && filters.collectionIds.length > 0) {
    clauses.push(Prisma.sql`d.collection_id = ANY(${filters.collectionIds}::uuid[])`);
  }

  if (clauses.length === 0) {
    return Prisma.sql``;
  }

  return Prisma.sql`AND ${Prisma.join(clauses, ' AND ')}`;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function parseVectorLiteral(literal: string): number[] {
  const inner = literal.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (inner.length === 0) {
    return [];
  }
  return inner.split(',').map((value) => Number(value));
}

function toEntity(row: {
  id: string;
  organization_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: unknown;
  created_at: Date;
  deleted_at: Date | null;
}): KnowledgeChunkEntity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    tokenCount: row.token_count,
    metadata: toObject(row.metadata),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function toContextEntity(row: RawChunkRow) {
  return {
    ...toEntity(row),
    documentTitle: row.document_title,
    documentContentType: row.document_content_type,
    sourceId: row.source_id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    externalId: row.external_id,
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
