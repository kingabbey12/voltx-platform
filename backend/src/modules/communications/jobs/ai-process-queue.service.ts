import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommsAiProcessingService } from './comms-ai-processing.service';
import { AI_PROCESS_QUEUE } from './communications-jobs.constants';

export interface AiProcessJobData {
  conversationId: string;
}

/**
 * Producer side of the AI post-processing queue — keeps summarization off
 * the inbound webhook/poll critical path. Queue injection is optional:
 * when REDIS_ENABLED is false (dev/test/single-instance), enqueue falls
 * back to running CommsAiProcessingService directly (fire-and-forget,
 * same as the attachments module's AttachmentProcessingQueueService
 * fallback) rather than silently never summarizing at all — summaries
 * still land moments later even with no queue backing them.
 */
@Injectable()
export class AiProcessQueueService {
  private readonly logger = new Logger(AiProcessQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(AI_PROCESS_QUEUE)
    private readonly queue: Queue<AiProcessJobData> | null,
    private readonly commsAiProcessingService: CommsAiProcessingService,
  ) {}

  enqueueSummarize(conversationId: string): void {
    if (!this.queue) {
      void this.commsAiProcessingService
        .summarize(conversationId)
        .catch((error: unknown) =>
          this.logger.error(
            { err: error, conversationId },
            'Synchronous-fallback AI summarization failed',
          ),
        );
      return;
    }

    void this.queue
      .add(
        'summarize',
        { conversationId },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      )
      .catch((error: unknown) =>
        this.logger.error({ err: error, conversationId }, 'Failed to enqueue AI summarize job'),
      );
  }
}
