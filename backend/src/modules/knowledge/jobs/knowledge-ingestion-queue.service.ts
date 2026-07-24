import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KnowledgeIngestionJobEntity } from '../entities/knowledge-ingestion-job.entity';
import { KnowledgeJobRunnerService } from './knowledge-job-runner.service';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion-queue.constants';

export interface KnowledgeIngestionJobData {
  jobId: string;
  organizationId: string;
}

/**
 * Enqueues ingestion jobs onto BullMQ when Redis is enabled; otherwise runs
 * them inline (awaited) so dev/test and single-instance deployments still
 * process ingestion — the same REDIS_ENABLED-gated fallback used by the agent
 * task, workflow, and comms queues. Queue injection is @Optional() so the
 * provider resolves even when BullModule isn't registered.
 */
@Injectable()
export class KnowledgeIngestionQueueService {
  private readonly logger = new Logger(KnowledgeIngestionQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(KNOWLEDGE_INGESTION_QUEUE)
    private readonly queue: Queue<KnowledgeIngestionJobData> | null,
    private readonly runner: KnowledgeJobRunnerService,
  ) {}

  async enqueue(job: KnowledgeIngestionJobEntity): Promise<void> {
    if (!this.queue) {
      // Synchronous fallback: run to completion so the job's final state is
      // observable immediately (GET /knowledge/jobs). Failures are already
      // recorded on the job row by the runner.
      await this.runner
        .run(job.id)
        .catch((error: unknown) =>
          this.logger.error(
            { err: error, jobId: job.id },
            'Synchronous-fallback knowledge ingestion failed',
          ),
        );
      return;
    }

    await this.queue.add(
      job.type,
      { jobId: job.id, organizationId: job.organizationId },
      {
        jobId: `knowledge-job:${job.id}`,
        attempts: job.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
