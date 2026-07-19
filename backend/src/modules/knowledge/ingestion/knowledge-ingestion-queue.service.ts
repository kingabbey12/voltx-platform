import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KnowledgeIngestionJobEntity } from '../entities/knowledge-ingestion-job.entity';
import { IngestDocumentRequest, KnowledgeService } from '../knowledge.service';
import { KnowledgeIngestionJobRepository } from './knowledge-ingestion-job.repository';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion-queue.constants';
import { KnowledgeIngestionRuntimeService } from './knowledge-ingestion-runtime.service';

export interface KnowledgeIngestionQueueJobData {
  trackingJobId: string;
  organizationId: string;
}

@Injectable()
export class KnowledgeIngestionQueueService {
  private readonly logger = new Logger(KnowledgeIngestionQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(KNOWLEDGE_INGESTION_QUEUE)
    private readonly queue: Queue<KnowledgeIngestionQueueJobData> | null,
    private readonly knowledgeService: KnowledgeService,
    private readonly jobRepository: KnowledgeIngestionJobRepository,
    private readonly runtimeService: KnowledgeIngestionRuntimeService,
  ) {}

  async enqueueIngestion(request: IngestDocumentRequest): Promise<KnowledgeIngestionJobEntity> {
    // Validate source ownership before creating a job.
    await this.knowledgeService.getSourceOrThrow(request.sourceId);

    const tracking = await this.jobRepository.createQueued({
      sourceId: request.sourceId,
      payload: {
        sourceId: request.sourceId,
        externalId: request.externalId,
        title: request.title,
        contentType: request.contentType,
        text: request.text,
        fileBase64: request.fileBase64,
        metadata: request.metadata,
      },
    });

    if (!this.queue) {
      // Synchronous fallback mirrors existing behavior when Redis is disabled.
      const startedAt = new Date();
      try {
        const result = await this.knowledgeService.ingestDocument(request);
        await this.jobRepository.updateSystem(tracking.id, {
          status: result.status === 'INDEXED' ? 'READY' : 'FAILED',
          progressPercent: 100,
          attemptsMade: 1,
          startedAt,
          completedAt: new Date(),
          documentId: result.documentId,
          lastError: result.error ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Knowledge ingestion failed';
        await this.jobRepository.updateSystem(tracking.id, {
          status: 'FAILED',
          progressPercent: 100,
          attemptsMade: 1,
          startedAt,
          completedAt: new Date(),
          lastError: message,
        });
        throw error;
      }
      return (await this.jobRepository.findById(tracking.id)) ?? tracking;
    }

    await this.queue.add(
      'ingest_document',
      { trackingJobId: tracking.id, organizationId: tracking.organizationId },
      {
        jobId: `knowledge-${tracking.id}`,
        attempts: tracking.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    return tracking;
  }

  async requestCancellation(jobId: string): Promise<KnowledgeIngestionJobEntity | null> {
    const updated = await this.jobRepository.markCancellationRequested(jobId);
    if (!updated) {
      return null;
    }

    if (!this.queue) {
      this.runtimeService.cancel(jobId);
      return updated;
    }

    const queueJob = await this.queue.getJob(`knowledge-${jobId}`);
    if (queueJob && (await queueJob.isWaiting())) {
      await queueJob.remove();
      await this.jobRepository.updateSystem(jobId, {
        status: 'CANCELLED',
        progressPercent: Math.max(updated.progressPercent, 100),
        completedAt: new Date(),
        lastError: 'Cancelled before execution started',
      });
    } else {
      this.runtimeService.cancel(jobId);
    }

    return this.jobRepository.findById(jobId);
  }

  async resume(jobId: string): Promise<KnowledgeIngestionJobEntity | null> {
    const previous = await this.jobRepository.findById(jobId);
    if (!previous) {
      return null;
    }
    if (!['FAILED', 'CANCELLED'].includes(previous.status)) {
      return previous;
    }

    const resumed = await this.jobRepository.createQueued({
      sourceId: previous.sourceId,
      documentId: previous.documentId,
      payload: previous.payload,
      maxAttempts: previous.maxAttempts,
      resumeFromJobId: previous.id,
    });

    if (!this.queue) {
      await this.knowledgeService.processQueuedIngestionJob(resumed.id);
      return (await this.jobRepository.findById(resumed.id)) ?? resumed;
    }

    await this.queue.add(
      'ingest_document',
      { trackingJobId: resumed.id, organizationId: resumed.organizationId },
      {
        jobId: `knowledge-${resumed.id}`,
        attempts: resumed.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log({ previousJobId: jobId, resumedJobId: resumed.id }, 'Resumed ingestion job');
    return resumed;
  }
}
