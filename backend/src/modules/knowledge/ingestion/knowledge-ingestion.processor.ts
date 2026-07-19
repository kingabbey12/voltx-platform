import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion-queue.constants';
import { KnowledgeIngestionQueueJobData } from './knowledge-ingestion-queue.service';
import { KnowledgeService } from '../knowledge.service';

@Processor(KNOWLEDGE_INGESTION_QUEUE)
export class KnowledgeIngestionProcessor extends WorkerHost {
  constructor(private readonly knowledgeService: KnowledgeService) {
    super();
  }

  async process(job: Job<KnowledgeIngestionQueueJobData>): Promise<void> {
    await this.knowledgeService.processQueuedIngestionJob(
      job.data.trackingJobId,
      job.attemptsMade + 1,
    );
  }
}
