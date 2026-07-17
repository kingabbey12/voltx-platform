import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ATTACHMENT_PROCESS_QUEUE } from './attachment-processing.constants';
import { AttachmentProcessingService } from './attachment-processing.service';

export interface AttachmentProcessJobData {
  attachmentId: string;
  /** Best-effort — carried through so a job that exhausts its retries can be attributed to an org in BackgroundJobFailure without the dead-letter listener needing to look anything up. */
  organizationId?: string | null;
}

/**
 * Enqueues the scan/thumbnail/extract pipeline. Unlike
 * CommsAiProcessQueueService (nice-to-have summarization, safe to skip
 * without Redis), attachment processing is load-bearing — an attachment
 * stuck at PENDING forever is a broken upload. So when the BullMQ queue
 * isn't available (REDIS_ENABLED=false), this runs the pipeline
 * synchronously instead of dropping it.
 */
@Injectable()
export class AttachmentProcessingQueueService {
  private readonly logger = new Logger(AttachmentProcessingQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(ATTACHMENT_PROCESS_QUEUE)
    private readonly queue: Queue<AttachmentProcessJobData> | null,
    private readonly attachmentProcessingService: AttachmentProcessingService,
  ) {}

  enqueue(attachmentId: string, organizationId?: string | null): void {
    if (!this.queue) {
      this.logger.debug(
        { attachmentId },
        'Attachment process queue not available (REDIS_ENABLED=false) — processing synchronously',
      );
      void this.attachmentProcessingService
        .process(attachmentId)
        .catch((error: unknown) =>
          this.logger.error(
            { err: error, attachmentId },
            'Synchronous attachment processing failed',
          ),
        );
      return;
    }

    void this.queue
      .add(
        'process',
        { attachmentId, organizationId },
        {
          // v2.2 Platform Scale — deterministic per-attachment id: a
          // duplicate enqueue for the same attachment (e.g. a retried
          // upload-completion callback) collides in BullMQ instead of
          // running the pipeline twice concurrently.
          // "-" not ":" — BullMQ reserves ":" and rejects custom ids
          // containing it (caught live in the v1.0.0-rc1 staging smoke).
          jobId: `process-${attachmentId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      )
      .catch((error: unknown) =>
        this.logger.error(
          { err: error, attachmentId },
          'Failed to enqueue attachment processing job',
        ),
      );
  }
}
