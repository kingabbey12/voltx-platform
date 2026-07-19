import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from '../ai/ai.module';
import { TextChunkerService } from './chunking/text-chunker.service';
import { KnowledgeChunkRepository } from './chunks/knowledge-chunk.repository';
import { KnowledgeContextBuilderService } from './context/knowledge-context-builder.service';
import { KnowledgeDocumentRepository } from './documents/knowledge-document.repository';
import { DocxTextExtractor } from './extraction/docx-text-extractor';
import { HtmlTextExtractor } from './extraction/html-text-extractor';
import { PdfTextExtractor } from './extraction/pdf-text-extractor';
import { PlainTextExtractor } from './extraction/plain-text-extractor';
import { PptxTextExtractor } from './extraction/pptx-text-extractor';
import { TextExtractorRegistry } from './extraction/text-extractor.registry';
import { XlsxTextExtractor } from './extraction/xlsx-text-extractor';
import { KnowledgeGraphRepository } from './graph/knowledge-graph.repository';
import { KnowledgeGraphService } from './graph/knowledge-graph.service';
import { KnowledgeEmbeddingBackfillService } from './ingestion/knowledge-embedding-backfill.service';
import { KnowledgeIngestionJobRepository } from './ingestion/knowledge-ingestion-job.repository';
import { KNOWLEDGE_INGESTION_QUEUE } from './ingestion/knowledge-ingestion-queue.constants';
import { KnowledgeIngestionProcessor } from './ingestion/knowledge-ingestion.processor';
import { KnowledgeIngestionQueueService } from './ingestion/knowledge-ingestion-queue.service';
import { KnowledgeIngestionRuntimeService } from './ingestion/knowledge-ingestion-runtime.service';
import { KnowledgeIngestionService } from './ingestion/knowledge-ingestion.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeSearchLogRepository } from './observability/knowledge-search-log.repository';
import { KnowledgeStatsService } from './observability/knowledge-stats.service';
import { KnowledgeEvaluationService } from './observability/knowledge-evaluation.service';
import { embeddingCacheProvider } from './retrieval/embedding-cache';
import { DefaultRerankerProvider } from './retrieval/default-reranker.provider';
import { KnowledgeRerankerService } from './retrieval/knowledge-reranker.service';
import { KnowledgeRetrievalService } from './retrieval/knowledge-retrieval.service';
import { KnowledgeSourceRepository } from './sources/knowledge-source.repository';

const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: KNOWLEDGE_INGESTION_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [KnowledgeIngestionProcessor] : [];

@Module({
  imports: [forwardRef(() => AIModule), ...queueImports],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeSourceRepository,
    KnowledgeDocumentRepository,
    KnowledgeChunkRepository,
    KnowledgeIngestionJobRepository,
    KnowledgeGraphRepository,
    KnowledgeGraphService,
    KnowledgeSearchLogRepository,
    KnowledgeStatsService,
    KnowledgeEvaluationService,
    PdfTextExtractor,
    DocxTextExtractor,
    XlsxTextExtractor,
    PptxTextExtractor,
    HtmlTextExtractor,
    PlainTextExtractor,
    TextExtractorRegistry,
    TextChunkerService,
    KnowledgeIngestionService,
    KnowledgeIngestionRuntimeService,
    KnowledgeIngestionQueueService,
    KnowledgeEmbeddingBackfillService,
    embeddingCacheProvider,
    DefaultRerankerProvider,
    KnowledgeRerankerService,
    KnowledgeRetrievalService,
    KnowledgeContextBuilderService,
    KnowledgeService,
    ...queueProcessors,
  ],
  exports: [
    KnowledgeContextBuilderService,
    KnowledgeRetrievalService,
    KnowledgeGraphService,
    KnowledgeIngestionService,
    KnowledgeIngestionQueueService,
    KnowledgeStatsService,
    KnowledgeSourceRepository,
    TextExtractorRegistry,
  ],
})
export class KnowledgeModule {}
