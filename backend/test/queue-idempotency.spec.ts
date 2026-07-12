import { AttachmentProcessingQueueService } from '../src/modules/attachments/processing/attachment-processing-queue.service';
import { AttachmentProcessingService } from '../src/modules/attachments/processing/attachment-processing.service';
import { AiProcessQueueService } from '../src/modules/communications/jobs/ai-process-queue.service';
import { CommsAiProcessingService } from '../src/modules/communications/jobs/comms-ai-processing.service';

/**
 * v2.2 Platform Scale (Phase 10) — a duplicate enqueue for the same
 * logical unit of work (a retried callback, several inbound messages in
 * quick succession) must collide on a deterministic BullMQ jobId rather
 * than stacking up redundant jobs. AgentTaskQueueService, StripeWebhookQueueService,
 * and WorkflowRunQueueService already had this (see their own specs);
 * this file covers the two that didn't.
 */
describe('Queue idempotency (deterministic jobId)', () => {
  describe('AttachmentProcessingQueueService', () => {
    it('enqueues with a deterministic per-attachment jobId', () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const attachmentProcessingService = {
        process: jest.fn(),
      } as unknown as AttachmentProcessingService;
      const service = new AttachmentProcessingQueueService(
        queue as never,
        attachmentProcessingService,
      );

      service.enqueue('attachment-1', 'org-1');

      expect(queue.add).toHaveBeenCalledWith(
        'process',
        { attachmentId: 'attachment-1', organizationId: 'org-1' },
        expect.objectContaining({ jobId: 'process:attachment-1' }),
      );
    });

    it('processes synchronously with no jobId concept when Redis is disabled', () => {
      const attachmentProcessingService = {
        process: jest.fn().mockResolvedValue(undefined),
      } as unknown as AttachmentProcessingService;
      const service = new AttachmentProcessingQueueService(null, attachmentProcessingService);

      service.enqueue('attachment-1', 'org-1');

      expect(attachmentProcessingService.process).toHaveBeenCalledWith('attachment-1');
    });
  });

  describe('AiProcessQueueService', () => {
    it('enqueues with a deterministic per-conversation jobId', () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const commsAiProcessingService = {
        summarize: jest.fn(),
      } as unknown as CommsAiProcessingService;
      const service = new AiProcessQueueService(queue as never, commsAiProcessingService);

      service.enqueueSummarize('conversation-1', 'org-1');

      expect(queue.add).toHaveBeenCalledWith(
        'summarize',
        { conversationId: 'conversation-1', organizationId: 'org-1' },
        expect.objectContaining({ jobId: 'summarize:conversation-1' }),
      );
    });

    it('processes synchronously with no jobId concept when Redis is disabled', () => {
      const commsAiProcessingService = {
        summarize: jest.fn().mockResolvedValue(undefined),
      } as unknown as CommsAiProcessingService;
      const service = new AiProcessQueueService(null, commsAiProcessingService);

      service.enqueueSummarize('conversation-1', 'org-1');

      expect(commsAiProcessingService.summarize).toHaveBeenCalledWith('conversation-1');
    });
  });
});
