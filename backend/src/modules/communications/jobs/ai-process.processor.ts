import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { MessageRepository } from '../conversation/message.repository';
import { AIConversationSummaryRepository } from '../conversation/ai-conversation-summary.repository';
import { CommsAiService } from './comms-ai.service';
import { AI_PROCESS_QUEUE } from './communications-jobs.constants';
import { AiProcessJobData } from './ai-process-queue.service';

@Processor(AI_PROCESS_QUEUE)
export class AiProcessProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessProcessor.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly summaryRepository: AIConversationSummaryRepository,
    private readonly commsAiService: CommsAiService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {
    super();
  }

  async process(job: Job<AiProcessJobData>): Promise<void> {
    const { conversationId } = job.data;

    try {
      const conversation = await this.conversationRepository.findByIdUnscoped(conversationId);
      if (!conversation) return;

      const connection = await this.channelConnectionRepository.findByIdUnscoped(
        conversation.connectionId,
      );
      if (!connection) return;

      const membership = await this.authContextRepository.findActiveMembershipContext(
        connection.createdBy,
        connection.organizationId,
      );

      await this.tenantContextService.run(
        {
          organizationId: connection.organizationId,
          userId: connection.createdBy,
          membershipId: membership?.id ?? '',
          requestId: randomUUID(),
        },
        async () => {
          const { items: messages } = await this.messageRepository.findByConversation(
            conversationId,
            1,
            50,
          );
          if (messages.length === 0) return;

          const workspaceContext = messages
            .slice(-20)
            .map((message) => `[${message.direction}] ${message.body.slice(0, 500)}`);

          const result = await this.commsAiService.summarizeConversation(workspaceContext);

          await this.summaryRepository.create(connection.organizationId, {
            conversationId,
            summary: result.summary,
            sentiment: result.sentiment,
            urgency: result.urgency,
            intent: result.intent,
          });
        },
      );
    } catch (error) {
      this.logger.error({ err: error, conversationId }, 'AI conversation summarization failed');
      throw error; // Rethrow so BullMQ applies the configured retry/backoff.
    }
  }
}
