import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeadLetterListenerService } from '../../background-jobs/dead-letter-listener.service';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion-queue.constants';
import { KnowledgeIngestionQueueJobData } from './knowledge-ingestion-queue.service';
import { KnowledgeService } from '../knowledge.service';

@Processor(KNOWLEDGE_INGESTION_QUEUE)
export class KnowledgeIngestionProcessor extends WorkerHost {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly deadLetters: DeadLetterListenerService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeIngestionQueueJobData>): Promise<void> {
    await this.knowledgeService.processQueuedIngestionJob(
      job.data.trackingJobId,
      job.attemptsMade + 1,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<KnowledgeIngestionQueueJobData> | undefined,
    error: Error,
  ): Promise<void> {
    await this.deadLetters.recordFailedJob(KNOWLEDGE_INGESTION_QUEUE, job, error);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.deadLetters.logWorkerRedisError(KNOWLEDGE_INGESTION_QUEUE, error);
  }
}
