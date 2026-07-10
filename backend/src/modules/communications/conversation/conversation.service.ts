import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { AttachmentService } from '../../attachments/attachment.service';
import { streamToBuffer } from '../../attachments/stream-to-buffer.util';
import { OutboundAttachment, ParsedStatusUpdate } from '../channels/channel-provider.interface';
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
import { CommunicationEventRepository } from './communication-event.repository';
import { MessageRepository } from './message.repository';
import { NoteRepository } from './note.repository';
import { CommsConversationEntity } from './entities/conversation.entity';
import { CommsMessageEntity } from './entities/message.entity';
import { CommsNoteEntity } from './entities/note.entity';

export interface SendMessageRequest {
  conversationId: string;
  body: string;
  senderId: string;
  attachmentIds?: string[];
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly noteRepository: NoteRepository,
    private readonly communicationEventRepository: CommunicationEventRepository,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly attachmentService: AttachmentService,
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

  /** Internal, agent-only commentary — never sent through the channel, never visible to the customer. See CommsNote's schema doc comment. */
  async addNote(conversationId: string, authorId: string, body: string): Promise<CommsNoteEntity> {
    await this.getConversationOrThrow(conversationId);
    const note = await this.noteRepository.create(conversationId, authorId, body);
    await this.auditService.record({
      action: 'communications.note.created',
      resource: 'comms_note',
      resourceId: note.id,
      metadata: { conversationId },
    });
    return note;
  }

  async listNotes(conversationId: string): Promise<CommsNoteEntity[]> {
    await this.getConversationOrThrow(conversationId);
    return this.noteRepository.findByConversation(conversationId);
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
    if (request.body.trim().length === 0 && !request.attachmentIds?.length) {
      throw new BadRequestException('Message must include text or at least one attachment');
    }

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

    let attachments: OutboundAttachment[] = [];
    if (request.attachmentIds?.length) {
      await Promise.all(
        request.attachmentIds.map((attachmentId) =>
          this.attachmentService.addReference(attachmentId, 'COMMS_MESSAGE', message.id),
        ),
      );
      attachments = await this.loadAttachmentsForSend(request.attachmentIds);
    }

    try {
      const result = await provider.sendMessage(
        {
          externalThreadId: conversation.externalThreadId ?? undefined,
          // externalThreadId doubles as the recipient address for
          // message-based channels (WhatsApp/Twilio SMS's customer phone
          // number) — Slack/Teams ignore `to` and use externalThreadId
          // directly, but WhatsApp/Twilio SMS read `to` as the send target,
          // so it must carry the same value or a reply goes nowhere.
          to: conversation.externalThreadId ?? '',
          body: request.body,
          attachments,
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

  /** Loads the real bytes for each attachment so the channel provider can forward them natively (Gmail MIME part, Slack file share, Graph fileAttachment, etc.) rather than just linking them in our own database. */
  private async loadAttachmentsForSend(attachmentIds: string[]): Promise<OutboundAttachment[]> {
    return Promise.all(
      attachmentIds.map(async (attachmentId) => {
        const attachment = await this.attachmentService.getById(attachmentId);
        const { stream } = await this.attachmentService.getReadStreamForDownload(attachmentId);
        const buffer = await streamToBuffer(stream);
        const { url } = await this.attachmentService.getSignedDownloadUrl(attachmentId);
        return {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          buffer,
          signedUrl: url,
        };
      }),
    );
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

    if (parsed.attachments?.length) {
      const connection = await this.channelConnectionRepository.findByIdUnscoped(connectionId);
      if (connection) {
        for (const inbound of parsed.attachments) {
          const attachment = await this.attachmentService.uploadSingleUnscoped(
            organizationId,
            connection.createdBy,
            { fileName: inbound.fileName, mimeType: inbound.mimeType, buffer: inbound.buffer },
          );
          await this.attachmentService.addReferenceUnscoped(
            organizationId,
            attachment.id,
            'COMMS_MESSAGE',
            message.id,
          );
        }
      }
    }

    await this.conversationRepository.update(conversation.id, {
      lastMessageAt: parsed.occurredAt ?? new Date(),
      unread: true,
    });

    this.commsGateway.emitNewMessage(organizationId, message);

    return message;
  }

  /**
   * Applies an asynchronous delivery/read/failure status update for a
   * message we sent (WhatsApp `statuses` webhook entries, Twilio SMS status
   * callbacks). Idempotent no-op if the externalId doesn't match a known
   * message — a status for something we didn't send, or one we've already
   * deleted, is not an error. Runs outside a request's tenant context, same
   * as ingestInboundMessage.
   */
  async ingestStatusUpdate(organizationId: string, update: ParsedStatusUpdate): Promise<void> {
    const message = await this.messageRepository.findByExternalIdUnscoped(update.externalId);
    if (!message) return;

    const occurredAt = update.occurredAt ?? new Date();
    const updated = await this.messageRepository.update(message.id, {
      status: update.status,
      ...(update.status === 'DELIVERED' ? { deliveredAt: occurredAt } : {}),
      ...(update.status === 'READ' ? { readAt: occurredAt } : {}),
      ...(update.status === 'FAILED' ? { failedReason: 'Channel reported delivery failure' } : {}),
    });

    if (update.status === 'DELIVERED' || update.status === 'READ') {
      await this.communicationEventRepository.createUnscoped(organizationId, {
        conversationId: message.conversationId,
        messageId: message.id,
        type: update.status,
        occurredAt,
      });
    }

    this.commsGateway.emitMessageStatus(organizationId, updated);
  }
}
