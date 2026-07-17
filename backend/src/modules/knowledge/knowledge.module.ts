import { forwardRef, Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { TextChunkerService } from './chunking/text-chunker.service';
import { KnowledgeChunkRepository } from './chunks/knowledge-chunk.repository';
import { KnowledgeContextBuilderService } from './context/knowledge-context-builder.service';
import { KnowledgeDocumentRepository } from './documents/knowledge-document.repository';
import { DocxTextExtractor } from './extraction/docx-text-extractor';
import { PdfTextExtractor } from './extraction/pdf-text-extractor';
import { PlainTextExtractor } from './extraction/plain-text-extractor';
import { PptxTextExtractor } from './extraction/pptx-text-extractor';
import { TextExtractorRegistry } from './extraction/text-extractor.registry';
import { XlsxTextExtractor } from './extraction/xlsx-text-extractor';
import { KnowledgeGraphRepository } from './graph/knowledge-graph.repository';
import { KnowledgeGraphService } from './graph/knowledge-graph.service';
import { KnowledgeEmbeddingBackfillService } from './ingestion/knowledge-embedding-backfill.service';
import { KnowledgeIngestionService } from './ingestion/knowledge-ingestion.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeSearchLogRepository } from './observability/knowledge-search-log.repository';
import { KnowledgeStatsService } from './observability/knowledge-stats.service';
import { embeddingCacheProvider } from './retrieval/embedding-cache';
import { KnowledgeRetrievalService } from './retrieval/knowledge-retrieval.service';
import { KnowledgeSourceRepository } from './sources/knowledge-source.repository';

@Module({
  imports: [forwardRef(() => AIModule)],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeSourceRepository,
    KnowledgeDocumentRepository,
    KnowledgeChunkRepository,
    KnowledgeGraphRepository,
    KnowledgeGraphService,
    KnowledgeSearchLogRepository,
    KnowledgeStatsService,
    PdfTextExtractor,
    DocxTextExtractor,
    XlsxTextExtractor,
    PptxTextExtractor,
    PlainTextExtractor,
    TextExtractorRegistry,
    TextChunkerService,
    KnowledgeIngestionService,
    KnowledgeEmbeddingBackfillService,
    embeddingCacheProvider,
    KnowledgeRetrievalService,
    KnowledgeContextBuilderService,
    KnowledgeService,
  ],
  exports: [
    KnowledgeContextBuilderService,
    KnowledgeRetrievalService,
    KnowledgeGraphService,
    KnowledgeIngestionService,
    KnowledgeStatsService,
    KnowledgeSourceRepository,
    TextExtractorRegistry,
  ],
})
export class KnowledgeModule {}
