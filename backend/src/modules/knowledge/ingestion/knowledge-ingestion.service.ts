import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderName } from '../../ai/models/ai-model.types';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { TextChunkerService } from '../chunking/text-chunker.service';
import { KnowledgeChunkRepository } from '../chunks/knowledge-chunk.repository';
import { KnowledgeDocumentRepository } from '../documents/knowledge-document.repository';
import { TextExtractorRegistry } from '../extraction/text-extractor.registry';
import { KnowledgeSourceRepository } from '../sources/knowledge-source.repository';
import {
  KnowledgeIngestionResult,
  KnowledgeIngestionStreamEvent,
} from './knowledge-ingestion-stream-event.types';

export interface IngestDocumentInput {
  sourceId: string;
  externalId?: string;
  title: string;
  contentType: string;
  buffer?: Buffer;
  text?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Owns the full ingestion pipeline: extract -> chunk -> embed -> store.
 * Expressed as an async generator (extract/chunk/embed/store events) so
 * the same method backs both a JSON summary response and a live SSE
 * stream for the admin reindex endpoint — the "one implementation, two
 * consumption modes" convention used everywhere else in this codebase.
 * Per-document failures are caught and reported as a result, never
 * thrown, so a bulk reindex over many documents isn't aborted by one bad
 * file.
 */
@Injectable()
export class KnowledgeIngestionService {
  private readonly logger = new Logger(KnowledgeIngestionService.name);
  private readonly embeddingProvider: AIProviderName;
  private readonly embeddingModel: string;
  private readonly embeddingDimensions: number;
  private readonly embeddingBatchSize: number;

  constructor(
    private readonly knowledgeDocumentRepository: KnowledgeDocumentRepository,
    private readonly knowledgeChunkRepository: KnowledgeChunkRepository,
    private readonly knowledgeSourceRepository: KnowledgeSourceRepository,
    private readonly textExtractorRegistry: TextExtractorRegistry,
    private readonly textChunkerService: TextChunkerService,
    private readonly aiGatewayService: AIGatewayService,
    configService: ConfigService,
  ) {
    this.embeddingProvider = configService.get<AIProviderName>(
      'knowledge.embeddingProvider',
      'openai',
    );
    this.embeddingModel = configService.get<string>(
      'knowledge.embeddingModel',
      'text-embedding-3-small',
    );
    this.embeddingDimensions = configService.get<number>('knowledge.embeddingDimensions', 1536);
    this.embeddingBatchSize = configService.get<number>('knowledge.embeddingBatchSize', 64);
  }

  async *ingestDocument(
    input: IngestDocumentInput,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult> {
    const document = await this.findOrCreateDocument(input);

    yield {
      type: 'indexing_started',
      documentId: document.id,
      sourceId: input.sourceId,
      title: input.title,
    };

    try {
      await this.knowledgeDocumentRepository.update(document.id, { status: 'INDEXING' });

      const extractedText = await this.textExtractorRegistry.extract({
        contentType: input.contentType,
        buffer: input.buffer,
        text: input.text,
      });

      yield {
        type: 'text_extracted',
        documentId: document.id,
        characterCount: extractedText.length,
      };

      const result = yield* this.chunkEmbedAndStore(document.id, extractedText, signal);

      await this.knowledgeDocumentRepository.update(document.id, {
        status: 'INDEXED',
        rawText: extractedText,
        indexedAt: new Date(),
        error: null,
      });
      await this.knowledgeSourceRepository.markIndexed(input.sourceId);

      yield { type: 'indexing_completed', documentId: document.id, chunkCount: result.chunkCount };

      return { documentId: document.id, status: 'INDEXED', chunkCount: result.chunkCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Knowledge ingestion failed';
      this.logger.error({ err: error, documentId: document.id }, 'Knowledge ingestion failed');

      await this.knowledgeDocumentRepository.update(document.id, {
        status: 'FAILED',
        error: errorMessage,
      });

      yield { type: 'indexing_failed', documentId: document.id, error: errorMessage };

      return { documentId: document.id, status: 'FAILED', chunkCount: 0, error: errorMessage };
    }
  }

  /**
   * Re-chunks and re-embeds a document from its already-extracted text —
   * useful after a chunking/embedding config change without needing the
   * original binary again. Source-level "Reindex" iterates this over
   * every document under a source.
   */
  async *reindexDocument(
    documentId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult> {
    const document = await this.knowledgeDocumentRepository.findById(documentId);
    if (!document) {
      return { documentId, status: 'FAILED', chunkCount: 0, error: 'Document not found' };
    }
    if (!document.rawText) {
      return {
        documentId,
        status: 'FAILED',
        chunkCount: 0,
        error: 'Document has no stored extracted text to reindex from',
      };
    }

    yield {
      type: 'indexing_started',
      documentId: document.id,
      sourceId: document.sourceId,
      title: document.title,
    };

    try {
      await this.knowledgeDocumentRepository.update(document.id, { status: 'INDEXING' });

      const result = yield* this.chunkEmbedAndStore(document.id, document.rawText, signal);

      await this.knowledgeDocumentRepository.update(document.id, {
        status: 'INDEXED',
        indexedAt: new Date(),
        error: null,
      });
      await this.knowledgeSourceRepository.markIndexed(document.sourceId);

      yield { type: 'indexing_completed', documentId: document.id, chunkCount: result.chunkCount };

      return { documentId: document.id, status: 'INDEXED', chunkCount: result.chunkCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Knowledge reindexing failed';
      this.logger.error({ err: error, documentId }, 'Knowledge reindexing failed');

      await this.knowledgeDocumentRepository.update(document.id, {
        status: 'FAILED',
        error: errorMessage,
      });

      yield { type: 'indexing_failed', documentId: document.id, error: errorMessage };

      return { documentId, status: 'FAILED', chunkCount: 0, error: errorMessage };
    }
  }

  async *reindexSource(
    sourceId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, KnowledgeIngestionResult[]> {
    const documents = await this.knowledgeDocumentRepository.listBySource(sourceId);
    const results: KnowledgeIngestionResult[] = [];

    for (const document of documents) {
      const result = yield* this.reindexDocument(document.id, signal);
      results.push(result);
    }

    return results;
  }

  private async *chunkEmbedAndStore(
    documentId: string,
    text: string,
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeIngestionStreamEvent, { chunkCount: number }> {
    await this.knowledgeChunkRepository.deleteByDocument(documentId);

    const chunks = this.textChunkerService.chunk(text);
    yield { type: 'chunking_completed', documentId, chunkCount: chunks.length };

    if (chunks.length === 0) {
      return { chunkCount: 0 };
    }

    yield { type: 'embedding_started', documentId, chunkCount: chunks.length };
    const embeddingStartedAt = Date.now();

    const batches = chunkArray(chunks, this.embeddingBatchSize);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      const response = await this.aiGatewayService.embeddings({
        provider: this.embeddingProvider,
        model: this.embeddingModel,
        input: batch.map((chunk) => chunk.content),
        documentId,
        signal,
      });

      for (const vector of response.vectors) {
        if (vector.length !== this.embeddingDimensions) {
          throw new InternalServerErrorException(
            `Embedding model "${this.embeddingModel}" returned ${vector.length}-dimensional vectors, expected ${this.embeddingDimensions}`,
          );
        }
      }

      embeddings.push(...response.vectors);
    }

    await this.knowledgeChunkRepository.createMany(
      chunks.map((chunk, index) => ({
        documentId,
        chunkIndex: chunk.index,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index],
      })),
    );

    yield {
      type: 'embedding_completed',
      documentId,
      chunkCount: chunks.length,
      durationMs: Date.now() - embeddingStartedAt,
    };

    return { chunkCount: chunks.length };
  }

  private async findOrCreateDocument(input: IngestDocumentInput) {
    if (input.externalId) {
      const existing = await this.knowledgeDocumentRepository.findBySourceAndExternalId(
        input.sourceId,
        input.externalId,
      );
      if (existing) {
        const updated = await this.knowledgeDocumentRepository.update(existing.id, {
          title: input.title,
          metadata: input.metadata,
        });
        return updated ?? existing;
      }
    }

    return this.knowledgeDocumentRepository.create({
      sourceId: input.sourceId,
      externalId: input.externalId,
      title: input.title,
      contentType: input.contentType,
      metadata: input.metadata,
    });
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
