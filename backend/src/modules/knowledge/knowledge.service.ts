import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { KnowledgeChunkRepository } from './chunks/knowledge-chunk.repository';
import {
  KnowledgeContextResult,
  KnowledgeContextBuilderService,
} from './context/knowledge-context-builder.service';
import { KnowledgeStreamEvent } from './context/knowledge-stream-event.types';
import { KnowledgeDocumentEntity } from './entities/knowledge-document.entity';
import { GraphTraversalNode, KnowledgeEntityType } from './entities/knowledge-graph.entity';
import { KnowledgeSourceEntity } from './entities/knowledge-source.entity';
import { KnowledgeGraphService, LinkEntitiesInput } from './graph/knowledge-graph.service';
import {
  FindKnowledgeDocumentsParams,
  KnowledgeDocumentRepository,
  PaginatedKnowledgeDocuments,
} from './documents/knowledge-document.repository';
import {
  IngestDocumentInput,
  KnowledgeIngestionService,
} from './ingestion/knowledge-ingestion.service';
import {
  KnowledgeIngestionResult,
  KnowledgeIngestionStreamEvent,
} from './ingestion/knowledge-ingestion-stream-event.types';
import { KnowledgeStats, KnowledgeStatsService } from './observability/knowledge-stats.service';
import { KnowledgeRetrievalService } from './retrieval/knowledge-retrieval.service';
import {
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
} from './retrieval/knowledge-retrieval.types';
import {
  CreateKnowledgeSourceData,
  FindKnowledgeSourcesParams,
  KnowledgeSourceRepository,
  PaginatedKnowledgeSources,
  UpdateKnowledgeSourceData,
} from './sources/knowledge-source.repository';

export interface IngestDocumentRequest {
  sourceId: string;
  externalId?: string;
  title: string;
  contentType: string;
  text?: string;
  fileBase64?: string;
  metadata?: Record<string, unknown>;
}

const BINARY_CONTENT_TYPES = new Set(['pdf', 'docx', 'xlsx', 'csv']);

/**
 * Thin orchestration layer for the admin API: sources/documents CRUD plus
 * the ingestion/retrieval/graph/observability services already built.
 * Controllers stay thin; this is where request DTOs get translated into
 * calls against the actual pipeline services.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly knowledgeSourceRepository: KnowledgeSourceRepository,
    private readonly knowledgeDocumentRepository: KnowledgeDocumentRepository,
    private readonly knowledgeChunkRepository: KnowledgeChunkRepository,
    private readonly knowledgeIngestionService: KnowledgeIngestionService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    private readonly knowledgeContextBuilderService: KnowledgeContextBuilderService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    private readonly knowledgeGraphService: KnowledgeGraphService,
    private readonly auditService: AuditService,
  ) {}

  async createSource(data: CreateKnowledgeSourceData): Promise<KnowledgeSourceEntity> {
    const source = await this.knowledgeSourceRepository.create(data);
    await this.auditService.record({
      action: 'create',
      resource: 'knowledge_source',
      resourceId: source.id,
      metadata: { type: source.type, name: source.name },
    });
    return source;
  }

  async listSources(params: FindKnowledgeSourcesParams): Promise<PaginatedKnowledgeSources> {
    return this.knowledgeSourceRepository.findAll(params);
  }

  async getSourceOrThrow(id: string): Promise<KnowledgeSourceEntity> {
    const source = await this.knowledgeSourceRepository.findById(id);
    if (!source) {
      throw new NotFoundException(`Knowledge source with id "${id}" not found`);
    }
    return source;
  }

  async updateSource(id: string, data: UpdateKnowledgeSourceData): Promise<KnowledgeSourceEntity> {
    const updated = await this.knowledgeSourceRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException(`Knowledge source with id "${id}" not found`);
    }
    await this.auditService.record({
      action: 'update',
      resource: 'knowledge_source',
      resourceId: id,
      metadata: data as Record<string, unknown>,
    });
    return updated;
  }

  async deleteSource(id: string): Promise<KnowledgeSourceEntity> {
    const deleted = await this.knowledgeSourceRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Knowledge source with id "${id}" not found`);
    }
    await this.knowledgeDocumentRepository.softDeleteBySource(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'knowledge_source',
      resourceId: id,
      metadata: { name: deleted.name },
    });
    return deleted;
  }

  async ingestDocument(request: IngestDocumentRequest): Promise<KnowledgeIngestionResult> {
    // The source id is a client-supplied URL path param — without this,
    // an authenticated user could ingest a document against another
    // organization's knowledge source (findById is tenant-scoped, so a
    // foreign id 404s here rather than silently succeeding).
    await this.getSourceOrThrow(request.sourceId);

    const generator = this.knowledgeIngestionService.ingestDocument(this.toIngestionInput(request));
    let step = await generator.next();
    while (!step.done) {
      step = await generator.next();
    }
    const result = step.value;

    await this.auditService.record({
      action: 'ingest',
      resource: 'knowledge_document',
      resourceId: result.documentId,
      metadata: {
        sourceId: request.sourceId,
        status: result.status,
        chunkCount: result.chunkCount,
      },
    });

    return result;
  }

  async *ingestDocumentStream(
    request: IngestDocumentRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult> {
    // Same tenant-ownership check as ingestDocument, run before any
    // streaming begins.
    await this.getSourceOrThrow(request.sourceId);
    return yield* this.knowledgeIngestionService.ingestDocument(
      this.toIngestionInput(request),
      signal,
    );
  }

  async listDocuments(params: FindKnowledgeDocumentsParams): Promise<PaginatedKnowledgeDocuments> {
    return this.knowledgeDocumentRepository.findAll(params);
  }

  async getDocumentOrThrow(id: string): Promise<KnowledgeDocumentEntity> {
    const document = await this.knowledgeDocumentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Knowledge document with id "${id}" not found`);
    }
    return document;
  }

  async deleteDocument(id: string): Promise<KnowledgeDocumentEntity> {
    const deleted = await this.knowledgeDocumentRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Knowledge document with id "${id}" not found`);
    }
    await this.knowledgeChunkRepository.deleteByDocument(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'knowledge_document',
      resourceId: id,
      metadata: { title: deleted.title },
    });
    return deleted;
  }

  async refreshDocument(id: string): Promise<KnowledgeIngestionResult> {
    const generator = this.knowledgeIngestionService.reindexDocument(id);
    let step = await generator.next();
    while (!step.done) {
      step = await generator.next();
    }
    return step.value;
  }

  refreshDocumentStream(
    id: string,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult> {
    return this.knowledgeIngestionService.reindexDocument(id, signal);
  }

  async reindexSource(sourceId: string): Promise<KnowledgeIngestionResult[]> {
    await this.getSourceOrThrow(sourceId);
    const generator = this.knowledgeIngestionService.reindexSource(sourceId);
    let step = await generator.next();
    while (!step.done) {
      step = await generator.next();
    }
    return step.value;
  }

  reindexSourceStream(
    sourceId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult[]> {
    return this.knowledgeIngestionService.reindexSource(sourceId, signal);
  }

  async search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    return this.knowledgeRetrievalService.search(query, options);
  }

  async preview(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeContextResult> {
    const generator = this.knowledgeContextBuilderService.buildContext(query, options);
    let step = await generator.next();
    while (!step.done) {
      step = await generator.next();
    }
    return step.value;
  }

  previewStream(
    query: string,
    options?: KnowledgeSearchOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeStreamEvent, KnowledgeContextResult> {
    return this.knowledgeContextBuilderService.buildContext(query, options, signal);
  }

  async getStats(): Promise<KnowledgeStats> {
    return this.knowledgeStatsService.getStats();
  }

  async getHealth(): Promise<{ healthy: boolean; reasons: string[] }> {
    return this.knowledgeStatsService.getHealth();
  }

  async linkGraphEntities(input: LinkEntitiesInput): Promise<void> {
    await this.knowledgeGraphService.linkEntities(input);
    await this.auditService.record({
      action: 'link',
      resource: 'knowledge_graph',
      metadata: { from: input.from, to: input.to, relationship: input.relationship },
    });
  }

  async traverseGraph(
    type: KnowledgeEntityType,
    externalId: string,
    hops: number,
  ): Promise<GraphTraversalNode[]> {
    return this.knowledgeGraphService.traverseByExternalId(type, externalId, hops);
  }

  private toIngestionInput(request: IngestDocumentRequest): IngestDocumentInput {
    const isBinary = BINARY_CONTENT_TYPES.has(request.contentType);

    if (isBinary && !request.fileBase64) {
      throw new BadRequestException(`Content type "${request.contentType}" requires fileBase64`);
    }
    if (!isBinary && !request.text) {
      throw new BadRequestException(`Content type "${request.contentType}" requires text`);
    }

    return {
      sourceId: request.sourceId,
      externalId: request.externalId,
      title: request.title,
      contentType: request.contentType,
      buffer: request.fileBase64 ? Buffer.from(request.fileBase64, 'base64') : undefined,
      text: request.text,
      metadata: request.metadata,
    };
  }
}

export type { CreateKnowledgeSourceData };
