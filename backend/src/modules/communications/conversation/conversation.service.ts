import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ParsedInboundMessage } from '../channels/channel-provider.interface';
import { CommsGateway } from '../realtime/comms.gateway';
import {
  ConversationRepository,
  FindCommsConversationsParams,
  PaginatedCommsConversations,
  UpdateCommsConversationData,
} from './conversation.repository';
import { MessageRepository } from './message.repository';
import { CommsConversationEntity } from './entities/conversation.entity';
import { CommsMessageEntity } from './entities/message.entity';

export interface SendMessageRequest {
  conversationId: string;
  body: string;
  senderId: string;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly auditService: AuditService,
    private readonly commsGateway: CommsGateway,
  ) {}

  async listConversations(
    params: FindCommsConversationsParams,
  ): Promise<PaginatedCommsConversations> {
    return this.conversationRepository.findAll(params);
  }

  async getConversationOrThrow(id: string): Promise<CommsConversationEntity> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation "${id}" not found`);
    }
    return conversation;
  }

  async listMessages(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ items: CommsMessageEntity[]; total: number }> {
    await this.getConversationOrThrow(conversationId);
    return this.messageRepository.findByConversation(conversationId, page, limit);
  }

  async updateConversation(
    id: string,
    data: UpdateCommsConversationData,
  ): Promise<CommsConversationEntity> {
    await this.getConversationOrThrow(id);
    const updated = await this.conversationRepository.update(id, data);
    await this.auditService.record({
      action: 'communications.conversation.updated',
      resource: 'comms_conversation',
      resourceId: id,
      metadata: data as Record<string, unknown>,
    });
    return updated;
  }

  /**
   * Sends a real message through the conversation's channel provider —
   * never marks a message SENT without an actual provider call succeeding.
   * Reuses ChannelConnectionService.getValidCredential so a near-expiry
   * token is transparently refreshed before send, same as every other
   * OAuth-backed call in this codebase.
   */
  async sendMessage(request: SendMessageRequest): Promise<CommsMessageEntity> {
    const conversation = await this.getConversationOrThrow(request.conversationId);
    const connection = await this.channelConnectionRepository.findById(conversation.connectionId);
    if (!connection) {
      throw new BadRequestException('This conversation has no active channel connection');
    }

    const provider = this.channelProviderRegistry.get(conversation.channel);
    const credential = await this.channelConnectionService.getValidCredential(connection);

    const message = await this.messageRepository.create({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      channel: conversation.channel,
      body: request.body,
      status: 'QUEUED',
      senderId: request.senderId,
    });

    try {
      const result = await provider.sendMessage(
        {
          externalThreadId: conversation.externalThreadId ?? undefined,
          to: '',
          body: request.body,
        },
        { organizationId: conversation.organizationId, connectionId: connection.id, credential },
      );

      const sent = await this.messageRepository.update(message.id, {
        status: result.status,
        externalId: result.externalId,
      });

      await this.conversationRepository.update(conversation.id, { lastMessageAt: new Date() });

      await this.auditService.record({
        action: 'communications.message.sent',
        resource: 'comms_message',
        resourceId: message.id,
        metadata: { conversationId: conversation.id, channel: conversation.channel },
      });

      this.commsGateway.emitMessageStatus(conversation.organizationId, sent);

      return sent;
    } catch (error) {
      await this.messageRepository.update(message.id, {
        status: 'FAILED',
        failedReason: error instanceof Error ? error.message : 'Unknown send error',
      });
      throw error;
    }
  }

  /**
   * Shared inbound-ingestion path for every channel (Gmail polling, Slack
   * webhooks, and later WhatsApp/Twilio/Teams) — finds or creates the
   * conversation by externalThreadId, then records the message. Runs
   * outside a request's tenant context (webhooks/background jobs have no
   * JWT), so it takes organizationId/connectionId explicitly rather than
   * reading TenantContextService.
   */
  async ingestInboundMessage(
    organizationId: string,
    connectionId: string,
    channel: CommsConversationEntity['channel'],
    parsed: ParsedInboundMessage,
  ): Promise<CommsMessageEntity | null> {
    if (parsed.externalId) {
      const existing = await this.messageRepository.findByExternalIdUnscoped(parsed.externalId);
      if (existing) return null; // Already ingested — idempotent.
    }

    const threadId = parsed.externalThreadId ?? parsed.externalId;
    let conversation = threadId
      ? await this.conversationRepository.findByConnectionAndExternalThreadUnscoped(
          connectionId,
          threadId,
        )
      : null;

    if (!conversation) {
      conversation = await this.conversationRepository.createUnscoped(organizationId, {
        connectionId,
        channel,
        subject: parsed.subject,
        externalThreadId: threadId,
      });
    }

    const message = await this.messageRepository.createUnscoped(organizationId, {
      conversationId: conversation.id,
      direction: 'INBOUND',
      channel,
      body: parsed.body,
      status: 'DELIVERED',
      externalId: parsed.externalId,
      metadata: { fromAddress: parsed.fromAddress, fromDisplayName: parsed.fromDisplayName },
      sentAt: parsed.occurredAt,
    });

    await this.conversationRepository.update(conversation.id, {
      lastMessageAt: parsed.occurredAt ?? new Date(),
      unread: true,
    });

    this.commsGateway.emitNewMessage(organizationId, message);

    return message;
  }
}
