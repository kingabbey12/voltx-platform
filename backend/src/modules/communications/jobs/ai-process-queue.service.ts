import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_PROCESS_QUEUE } from './communications-jobs.constants';

export interface AiProcessJobData {
  conversationId: string;
}

/**
 * Producer side of the AI post-processing queue — keeps summarization off
 * the inbound webhook/poll critical path. Queue injection is optional:
 * when REDIS_ENABLED is false (dev/test/single-instance), this becomes a
 * harmless no-op rather than a startup crash, matching the same
 * REDIS_ENABLED-gated pattern already used by the knowledge embedding
 * cache elsewhere in this codebase.
 */
@Injectable()
export class AiProcessQueueService {
  private readonly logger = new Logger(AiProcessQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(AI_PROCESS_QUEUE)
    private readonly queue: Queue<AiProcessJobData> | null,
  ) {}

  enqueueSummarize(conversationId: string): void {
    if (!this.queue) {
      this.logger.debug(
        { conversationId },
        'AI process queue not available (REDIS_ENABLED=false) — skipping background summarization',
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
