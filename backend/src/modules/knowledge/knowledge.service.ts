import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
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
  KnowledgeIngestionJobRepository,
  PaginatedKnowledgeIngestionJobs,
} from './ingestion/knowledge-ingestion-job.repository';
import { KnowledgeIngestionRuntimeService } from './ingestion/knowledge-ingestion-runtime.service';
import {
  KnowledgeIngestionResult,
  KnowledgeIngestionStreamEvent,
} from './ingestion/knowledge-ingestion-stream-event.types';
import { KnowledgeStats, KnowledgeStatsService } from './observability/knowledge-stats.service';
import {
  KnowledgeEvaluationCase,
  KnowledgeEvaluationResult,
  KnowledgeEvaluationService,
} from './observability/knowledge-evaluation.service';
import {
  KnowledgeSearchLogEntity,
  KnowledgeSearchLogRepository,
} from './observability/knowledge-search-log.repository';
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

export type IngestDocumentJobPayload = IngestDocumentRequest;

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
    private readonly tenantContextService: TenantContextService,
    private readonly knowledgeSourceRepository: KnowledgeSourceRepository,
    private readonly knowledgeDocumentRepository: KnowledgeDocumentRepository,
    private readonly knowledgeChunkRepository: KnowledgeChunkRepository,
    private readonly knowledgeIngestionJobRepository: KnowledgeIngestionJobRepository,
    private readonly knowledgeIngestionService: KnowledgeIngestionService,
    private readonly knowledgeIngestionRuntimeService: KnowledgeIngestionRuntimeService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    private readonly knowledgeContextBuilderService: KnowledgeContextBuilderService,
    private readonly knowledgeSearchLogRepository: KnowledgeSearchLogRepository,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    private readonly knowledgeEvaluationService: KnowledgeEvaluationService,
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

    await this.knowledgeRetrievalService.invalidateEmbeddingCache();

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
    await this.knowledgeRetrievalService.invalidateEmbeddingCache();
    return deleted;
  }

  async refreshDocument(id: string): Promise<KnowledgeIngestionResult> {
    const generator = this.knowledgeIngestionService.reindexDocument(id);
    let step = await generator.next();
    while (!step.done) {
      step = await generator.next();
    }
    await this.knowledgeRetrievalService.invalidateEmbeddingCache();
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
    await this.knowledgeRetrievalService.invalidateEmbeddingCache();
    return step.value;
  }

  async listIngestionJobs(params: {
    page: number;
    limit: number;
    status?: import('./entities/knowledge-ingestion-job.entity').KnowledgeIngestionJobStatus;
  }): Promise<PaginatedKnowledgeIngestionJobs> {
    return this.knowledgeIngestionJobRepository.listForCurrentOrganization(params);
  }

  async listFailures(page: number, limit: number): Promise<PaginatedKnowledgeIngestionJobs> {
    return this.knowledgeIngestionJobRepository.listFailuresForCurrentOrganization(page, limit);
  }

  async listSearches(
    page: number,
    limit: number,
  ): Promise<{
    items: KnowledgeSearchLogEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.knowledgeSearchLogRepository.list(page, limit);
  }

  async listChunks(params: { page: number; limit: number; documentId?: string }): Promise<{
    items: import('./entities/knowledge-chunk.entity').KnowledgeChunkWithContext[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.knowledgeChunkRepository.findAllWithContext(params);
  }

  async processQueuedIngestionJob(
    trackingJobId: string,
    attemptsMade = 1,
  ): Promise<KnowledgeIngestionResult> {
    const tracking = await this.knowledgeIngestionJobRepository.findByIdSystem(trackingJobId);
    if (!tracking) {
      throw new NotFoundException(`Knowledge ingestion job with id "${trackingJobId}" not found`);
    }

    const payload = tracking.payload as unknown as IngestDocumentJobPayload;
    const signal = this.knowledgeIngestionRuntimeService.register(trackingJobId);

    try {
      await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
        status: 'EXTRACTING',
        progressPercent: 10,
        attemptsMade,
        startedAt: new Date(),
      });

      const result = await this.tenantContextService.run(
        {
          organizationId: tracking.organizationId,
          userId: tracking.requestedByUserId,
          membershipId: tracking.requestedByMembershipId,
          requestId: randomUUID(),
        },
        async () => {
          const generator = this.knowledgeIngestionService.ingestDocument(
            this.toIngestionInput(payload),
            signal,
          );

          let step = await generator.next();
          while (!step.done) {
            await this.syncJobProgressFromEvent(trackingJobId, step.value);
            await this.throwIfCancellationRequested(trackingJobId);
            step = await generator.next();
          }

          return step.value;
        },
      );

      await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
        status: result.status === 'INDEXED' ? 'READY' : 'FAILED',
        progressPercent: 100,
        completedAt: new Date(),
        documentId: result.documentId,
        lastError: result.error ?? null,
      });

      await this.knowledgeRetrievalService.invalidateEmbeddingCache();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Knowledge ingestion job failed';
      const cancelled = await this.isCancellationRequested(trackingJobId);
      await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
        status: cancelled ? 'CANCELLED' : 'FAILED',
        progressPercent: 100,
        completedAt: new Date(),
        lastError: message,
      });

      if (cancelled) {
        return {
          documentId: tracking.documentId ?? '',
          status: 'FAILED',
          chunkCount: 0,
          error: 'Job cancelled',
        };
      }

      throw error;
    } finally {
      this.knowledgeIngestionRuntimeService.unregister(trackingJobId);
    }
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

  async evaluateRag(cases: KnowledgeEvaluationCase[]): Promise<KnowledgeEvaluationResult> {
    return this.knowledgeEvaluationService.evaluate(cases);
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
    if (!isBinary && !request.text && !request.fileBase64) {
      throw new BadRequestException(
        `Content type "${request.contentType}" requires text or fileBase64`,
      );
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

  private async syncJobProgressFromEvent(
    trackingJobId: string,
    event: KnowledgeIngestionStreamEvent,
  ): Promise<void> {
    switch (event.type) {
      case 'indexing_started':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'EXTRACTING',
          progressPercent: 15,
          documentId: event.documentId,
        });
        break;
      case 'text_extracted':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'CHUNKING',
          progressPercent: 35,
          documentId: event.documentId,
        });
        break;
      case 'chunking_completed':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'EMBEDDING',
          progressPercent: 60,
          documentId: event.documentId,
        });
        break;
      case 'embedding_started':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'EMBEDDING',
          progressPercent: 70,
          documentId: event.documentId,
        });
        break;
      case 'embedding_completed':
      case 'embedding_skipped':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'INDEXING',
          progressPercent: 85,
          documentId: event.documentId,
        });
        break;
      case 'indexing_completed':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'READY',
          progressPercent: 100,
          documentId: event.documentId,
        });
        break;
      case 'indexing_failed':
        await this.knowledgeIngestionJobRepository.updateSystem(trackingJobId, {
          status: 'FAILED',
          progressPercent: 100,
          documentId: event.documentId,
          lastError: event.error,
        });
        break;
      default:
        break;
    }
  }

  private async throwIfCancellationRequested(jobId: string): Promise<void> {
    if (await this.isCancellationRequested(jobId)) {
      this.knowledgeIngestionRuntimeService.cancel(jobId);
      throw new Error('Knowledge ingestion job was cancelled');
    }
  }

  private async isCancellationRequested(jobId: string): Promise<boolean> {
    const latest = await this.knowledgeIngestionJobRepository.findByIdSystem(jobId);
    return Boolean(latest?.cancellationRequestedAt);
  }
}

export type { CreateKnowledgeSourceData };
