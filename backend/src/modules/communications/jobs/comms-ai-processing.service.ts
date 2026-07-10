import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { MessageRepository } from '../conversation/message.repository';
import { AIConversationSummaryRepository } from '../conversation/ai-conversation-summary.repository';
import { CommsAiService } from './comms-ai.service';

/**
 * The actual "summarize this conversation" work, extracted so there is
 * exactly one implementation regardless of how it gets invoked — the
 * BullMQ worker (ai-process.processor.ts) when Redis is configured, or
 * AiProcessQueueService's direct synchronous fallback when it isn't.
 * Mirrors AttachmentProcessingService's identical role for the
 * attachments module.
 */
@Injectable()
export class CommsAiProcessingService {
  private readonly logger = new Logger(CommsAiProcessingService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly summaryRepository: AIConversationSummaryRepository,
    private readonly commsAiService: CommsAiService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async summarize(conversationId: string): Promise<void> {
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
      throw error;
    }
  }
}
