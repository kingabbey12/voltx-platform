import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { KnowledgeChunkRepository } from '../chunks/knowledge-chunk.repository';
import { KnowledgeDocumentRepository } from '../documents/knowledge-document.repository';
import { KnowledgeIngestionJobEntity } from '../entities/knowledge-ingestion-job.entity';
import { KnowledgeIngestionService } from '../ingestion/knowledge-ingestion.service';
import {
  KnowledgeIngestionResult,
  KnowledgeIngestionStreamEvent,
} from '../ingestion/knowledge-ingestion-stream-event.types';
import { KnowledgeJobStage } from '../entities/knowledge-ingestion-job.entity';
import { KnowledgeIngestionJobRepository } from './knowledge-ingestion-job.repository';

// Coarse per-event progress checkpoints so GET /knowledge/jobs shows movement.
const STAGE_BY_EVENT: Record<string, { stage: KnowledgeJobStage; progress: number }> = {
  text_extracted: { stage: 'PARSING', progress: 20 },
  chunking_completed: { stage: 'CHUNKING', progress: 40 },
  embedding_started: { stage: 'EMBEDDING', progress: 55 },
  embedding_completed: { stage: 'EMBEDDING', progress: 85 },
  indexing_completed: { stage: 'INDEXING', progress: 95 },
};

/**
 * Executes one ingestion job. Shared by the BullMQ processor (Redis on) and
 * the queue service's synchronous fallback (Redis off). Always re-establishes
 * the enqueuing user's tenant context from the job row, because the worker
 * runs outside any HTTP request. Reuses KnowledgeIngestionService for the
 * actual extract/chunk/embed/index work — no pipeline logic is duplicated here.
 */
@Injectable()
export class KnowledgeJobRunnerService {
  private readonly logger = new Logger(KnowledgeJobRunnerService.name);

  constructor(
    private readonly jobRepository: KnowledgeIngestionJobRepository,
    private readonly ingestionService: KnowledgeIngestionService,
    private readonly documentRepository: KnowledgeDocumentRepository,
    private readonly chunkRepository: KnowledgeChunkRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async run(jobId: string): Promise<void> {
    const job = await this.jobRepository.findByIdUnscoped(jobId);
    if (!job) {
      this.logger.warn({ jobId }, 'Knowledge ingestion job not found — skipping');
      return;
    }
    await this.tenantContextService.run(
      {
        organizationId: job.organizationId,
        userId: job.createdByUserId ?? undefined,
        membershipId: job.createdByMembershipId ?? undefined,
        requestId: `kjob:${jobId}`,
      },
      () => this.execute(job),
    );
  }

  private async execute(job: KnowledgeIngestionJobEntity): Promise<void> {
    await this.jobRepository.markRunning(job.id);
    try {
      switch (job.type) {
        case 'INGEST_DOCUMENT':
        case 'REINDEX_DOCUMENT': {
          const documentId = this.requireDocumentId(job);
          const result = await this.consume(
            job.id,
            this.ingestionService.reindexDocument(documentId),
          );
          await this.finalizeSingle(job.id, result);
          return;
        }
        case 'REINDEX_SOURCE': {
          const sourceId = this.requireSourceId(job);
          const results = await this.consume(job.id, this.ingestionService.reindexSource(sourceId));
          await this.finalizeMany(job.id, results);
          return;
        }
        case 'DELETE_DOCUMENT': {
          const documentId = this.requireDocumentId(job);
          await this.jobRepository.updateProgress(job.id, 'INDEXING', 50);
          await this.chunkRepository.deleteByDocument(documentId);
          await this.documentRepository.softDelete(documentId);
          await this.jobRepository.markCompleted(job.id, { deletedDocumentId: documentId });
          return;
        }
      }
    } catch (error) {
      // Unexpected/infra failure — record it and rethrow so BullMQ retries.
      const message = error instanceof Error ? error.message : 'Knowledge ingestion job failed';
      this.logger.error({ err: error, jobId: job.id }, 'Knowledge ingestion job failed');
      await this.jobRepository.markFailed(job.id, message);
      throw error;
    }
  }

  private async finalizeSingle(jobId: string, result: KnowledgeIngestionResult): Promise<void> {
    if (result.status === 'FAILED') {
      // A content-level failure (bad file, empty text) — no retry would help.
      await this.jobRepository.markFailed(jobId, result.error ?? 'Ingestion failed');
      return;
    }
    await this.jobRepository.markCompleted(jobId, { chunkCount: result.chunkCount });
  }

  private async finalizeMany(jobId: string, results: KnowledgeIngestionResult[]): Promise<void> {
    const failed = results.filter((result) => result.status === 'FAILED');
    if (failed.length > 0) {
      await this.jobRepository.markFailed(
        jobId,
        `${failed.length}/${results.length} documents failed to reindex`,
      );
      return;
    }
    const chunkCount = results.reduce((total, result) => total + result.chunkCount, 0);
    await this.jobRepository.markCompleted(jobId, {
      documentCount: results.length,
      chunkCount,
    });
  }

  private async consume<T>(
    jobId: string,
    generator: AsyncGenerator<KnowledgeIngestionStreamEvent, T>,
  ): Promise<T> {
    let next = await generator.next();
    while (!next.done) {
      const checkpoint = STAGE_BY_EVENT[next.value.type];
      if (checkpoint) {
        await this.jobRepository.updateProgress(jobId, checkpoint.stage, checkpoint.progress);
      }
      next = await generator.next();
    }
    return next.value;
  }

  private requireDocumentId(job: KnowledgeIngestionJobEntity): string {
    if (!job.documentId) {
      throw new Error(`Job ${job.id} of type ${job.type} is missing a documentId`);
    }
    return job.documentId;
  }

  private requireSourceId(job: KnowledgeIngestionJobEntity): string {
    if (!job.sourceId) {
      throw new Error(`Job ${job.id} of type ${job.type} is missing a sourceId`);
    }
    return job.sourceId;
  }
}
