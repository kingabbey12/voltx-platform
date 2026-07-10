import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ATTACHMENT_PROCESS_QUEUE } from './attachment-processing.constants';
import { AttachmentProcessingService } from './attachment-processing.service';
import { AttachmentProcessJobData } from './attachment-processing-queue.service';

@Processor(ATTACHMENT_PROCESS_QUEUE)
export class AttachmentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AttachmentProcessingProcessor.name);

  constructor(private readonly attachmentProcessingService: AttachmentProcessingService) {
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
}
