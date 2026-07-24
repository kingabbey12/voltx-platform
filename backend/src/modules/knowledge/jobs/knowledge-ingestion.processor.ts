import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KnowledgeJobRunnerService } from './knowledge-job-runner.service';
import { KnowledgeIngestionJobData } from './knowledge-ingestion-queue.service';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion-queue.constants';

/**
 * BullMQ worker for the knowledge ingestion queue (registered only when
 * REDIS_ENABLED=true). Delegates to KnowledgeJobRunnerService, which records
 * the job outcome and rethrows infra failures so BullMQ applies the job's
 * retry/backoff policy.
 */
@Processor(KNOWLEDGE_INGESTION_QUEUE)
export class KnowledgeIngestionProcessor extends WorkerHost {
  constructor(private readonly runner: KnowledgeJobRunnerService) {
    super();
  }

  async process(job: Job<KnowledgeIngestionJobData>): Promise<void> {
    await this.runner.run(job.data.jobId);
  }
}
