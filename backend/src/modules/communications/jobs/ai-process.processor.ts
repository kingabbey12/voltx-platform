import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CommsAiProcessingService } from './comms-ai-processing.service';
import { AI_PROCESS_QUEUE } from './communications-jobs.constants';
import { AiProcessJobData } from './ai-process-queue.service';

@Processor(AI_PROCESS_QUEUE)
export class AiProcessProcessor extends WorkerHost {
  constructor(private readonly commsAiProcessingService: CommsAiProcessingService) {
    super();
  }

  async process(job: Job<AiProcessJobData>): Promise<void> {
    // Rethrows on failure so BullMQ applies the configured retry/backoff —
    // CommsAiProcessingService.summarize already logs before rethrowing.
    await this.commsAiProcessingService.summarize(job.data.conversationId);
  }
}
