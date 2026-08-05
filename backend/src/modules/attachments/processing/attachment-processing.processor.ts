import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeadLetterListenerService } from '../../background-jobs/dead-letter-listener.service';
import { ATTACHMENT_PROCESS_QUEUE } from './attachment-processing.constants';
import { AttachmentProcessingService } from './attachment-processing.service';
import { AttachmentProcessJobData } from './attachment-processing-queue.service';

@Processor(ATTACHMENT_PROCESS_QUEUE)
export class AttachmentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AttachmentProcessingProcessor.name);

  constructor(
    private readonly attachmentProcessingService: AttachmentProcessingService,
    private readonly deadLetters: DeadLetterListenerService,
  ) {
    super();
  }

  async process(job: Job<AttachmentProcessJobData>): Promise<void> {
    const { attachmentId } = job.data;
    try {
      await this.attachmentProcessingService.process(attachmentId);
    } catch (error) {
      this.logger.error({ err: error, attachmentId }, 'Attachment processing failed');
      throw error; // Rethrow so BullMQ applies the configured retry/backoff.
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AttachmentProcessJobData> | undefined, error: Error): Promise<void> {
    await this.deadLetters.recordFailedJob(ATTACHMENT_PROCESS_QUEUE, job, error);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.deadLetters.logWorkerRedisError(ATTACHMENT_PROCESS_QUEUE, error);
  }
}
