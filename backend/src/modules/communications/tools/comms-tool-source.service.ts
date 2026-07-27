import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { ContactsService } from '../../sales/contacts/contacts.service';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { CommsChannel } from '../channels/channel-provider.interface';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ConversationService } from '../conversation/conversation.service';
import { MessageRepository } from '../conversation/message.repository';
import { AIConversationSummaryRepository } from '../conversation/ai-conversation-summary.repository';
import { CommsAiService } from '../jobs/comms-ai.service';

/**
 * Gives the AI agent runtime (Command Center) real access to the unified
 * inbox — summarize/draft-reply/extract-contact tools wrapping the exact
 * same ConversationService/CommsAiService/ContactsService the REST
 * controllers and background jobs use. No parallel summarization logic:
 * comms_summarize_conversation reuses CommsAiService.summarizeConversation,
 * the same code path the background AI-process queue runs after every
 * inbound message.
 */
@Injectable()
export class CommsToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly conversationService: ConversationService,
    private readonly messageRepository: MessageRepository,
    private readonly summaryRepository: AIConversationSummaryRepository,
    private readonly commsAiService: CommsAiService,
    private readonly contactsService: ContactsService,
    private readonly tenantContextService: TenantContextService,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildSummarizeTool(),
      this.buildDraftReplyTool(),
      this.buildExtractContactTool(),
      this.buildSendReplyTool(),
      this.buildSendChannelMessageTool('WHATSAPP', 'send_whatsapp_message', 'WhatsApp'),
      this.buildSendChannelMessageTool('TWILIO_SMS', 'send_sms_message', 'SMS'),
    ];
  }

  /**
   * Finds the org's active connection for `channel`, then either reuses
   * the existing conversation for `toAddress` or creates one — mirroring
   * exactly how ingestInboundMessage threads a conversation by
   * connectionId+externalThreadId, just from the outbound side. No new
   * conversation-management logic: same repository methods, same
   * threading key.
   */
  private async findOrCreateOutboundConversation(
    channel: CommsChannel,
    toAddress: string,
  ): Promise<string> {
    const connections = await this.channelConnectionRepository.findAll({
      page: 1,
      limit: 1,
      channel,
      status: 'CONNECTED',
    });
    const connection = connections.items[0];
    if (!connection) {
      throw new Error(`No connected ${channel} connection for this organization`);
    }

    const existing = await this.conversationRepository.findByConnectionAndExternalThreadUnscoped(
      connection.id,
      toAddress,
    );
    if (existing) {
      return existing.id;
    }

    const created = await this.conversationRepository.create({
      connectionId: connection.id,
      channel,
      externalThreadId: toAddress,
    });
    return created.id;
  }

  private buildSendReplyTool(): AITool {
    const conversationService = this.conversationService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description:
            'Conversation id to reply in (any channel — email, Slack, Teams, WhatsApp, SMS).',
          required: true,
        },
        body: { type: 'string', description: 'Message text to send.', required: true },
      },
    };

    return {
      name: 'comms_send_reply',
      description:
        'Send a real reply into an existing unified-inbox conversation, on whichever channel that conversation is on (Gmail, Outlook, Slack, Teams, WhatsApp, or SMS). This is a genuine, persisted send — not a draft.',
      inputSchema: schema,
      execute: async (input: { conversationId: string; body: string }) => {
        if (!input.body?.trim()) {
          throw new Error('body is required');
        }
        const { userId } = tenantContextService.getOrThrow();
        const sent = await conversationService.sendMessage({
          conversationId: input.conversationId,
          body: input.body,
          senderId: userId,
        });
        return { id: sent.id, status: sent.status };
      },
      ground(input) {
        const args = input as { conversationId: string };
        return {
          summary: 'Sent the reply',
          records: [{ type: 'conversation', id: args.conversationId, label: 'the conversation' }],
          events: [
            {
              description: 'Reply sent into the conversation',
              recordType: 'conversation',
              recordId: args.conversationId,
            },
          ],
        };
      },
    };
  }

  private buildSendChannelMessageTool(
    channel: CommsChannel,
    toolName: string,
    displayName: string,
  ): AITool {
    const conversationService = this.conversationService;
    const tenantContextService = this.tenantContextService;
    const findOrCreateOutboundConversation = this.findOrCreateOutboundConversation.bind(this);
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number, e.g. +15551234567.',
          required: true,
        },
        body: { type: 'string', description: 'Message text to send.', required: true },
      },
    };

    return {
      name: toolName,
      description: `Send a real outbound ${displayName} message to a phone number, starting a new conversation if one doesn't already exist. This is a genuine, persisted send.`,
      inputSchema: schema,
      execute: async (input: { to: string; body: string }) => {
        if (!input.to?.trim() || !input.body?.trim()) {
          throw new Error('to and body are required');
        }
        const { userId } = tenantContextService.getOrThrow();
        const conversationId = await findOrCreateOutboundConversation(channel, input.to);
        const sent = await conversationService.sendMessage({
          conversationId,
          body: input.body,
          senderId: userId,
        });
        return { id: sent.id, conversationId, status: sent.status };
      },
      ground(_input, output) {
        const data = output as { conversationId: string };
        return {
          summary: `Sent the ${displayName} message`,
          records: [{ type: 'conversation', id: data.conversationId, label: 'the conversation' }],
          events: [
            {
              description: `${displayName} message sent`,
              recordType: 'conversation',
              recordId: data.conversationId,
            },
          ],
        };
      },
    };
  }

  private async loadThread(conversationId: string): Promise<string[]> {
    await this.conversationService.getConversationOrThrow(conversationId);
    const { items } = await this.messageRepository.findByConversation(conversationId, 1, 50);
    return items.slice(-20).map((m) => `[${m.direction}] ${m.body.slice(0, 500)}`);
  }

  private buildSummarizeTool(): AITool {
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation id to summarize.',
          required: true,
        },
      },
    };

    return {
      name: 'comms_summarize_conversation',
      description:
        'Summarize a conversation from the unified inbox (email, Slack, etc.) with sentiment/urgency/intent classification.',
      inputSchema: schema,
      execute: async (input: { conversationId: string }) => {
        const existing = await this.summaryRepository.findLatest(input.conversationId);
        const thread = await this.loadThread(input.conversationId);
        if (thread.length === 0) {
          return { summary: 'No messages in this conversation yet.' };
        }

        const result = await this.commsAiService.summarizeConversation(thread);
        const organizationId = this.tenantContextService.getOrThrow().organizationId;
        await this.summaryRepository
          .create(organizationId, { conversationId: input.conversationId, ...result })
          .catch(() => undefined);
        return { ...result, previousSummary: existing?.summary ?? null };
      },
      ground(input) {
        const args = input as { conversationId: string };
        return {
          summary: 'Read and summarized the conversation',
          records: [{ type: 'conversation', id: args.conversationId, label: 'the conversation' }],
          events: [],
        };
      },
    };
  }

  private buildDraftReplyTool(): AITool {
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation id to reply to.',
          required: true,
        },
        instructions: {
          type: 'string',
          description:
            'Optional guidance for tone/content, e.g. "politely decline" or "offer a 10% discount".',
        },
      },
    };

    return {
      name: 'comms_draft_reply',
      description:
        'Draft a reply for a conversation in the unified inbox. Returns draft text only — never sends automatically.',
      inputSchema: schema,
      execute: async (input: { conversationId: string; instructions?: string }) => {
        const thread = await this.loadThread(input.conversationId);
        const context = [
          ...thread,
          input.instructions ? `Drafting instructions: ${input.instructions}` : '',
        ].filter(Boolean);

        const draft = await this.commsAiService.runPrompt(
          'Draft a reply to this conversation thread, matching its tone and addressing what the other party said. Respond with the reply text only — no preamble, no explanation, no quotes around it.',
          context,
        );
        return { draft: draft.trim() };
      },
      ground(input) {
        const args = input as { conversationId: string };
        return {
          summary: 'Drafted a reply — nothing was sent',
          records: [{ type: 'conversation', id: args.conversationId, label: 'the conversation' }],
          events: [],
        };
      },
    };
  }

  private buildExtractContactTool(): AITool {
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation to extract customer info from.',
          required: true,
        },
      },
    };

    return {
      name: 'comms_extract_contact_info',
      description:
        "Extract the customer's name/email/phone from a conversation thread and create a real CRM contact from it.",
      inputSchema: schema,
      execute: async (input: { conversationId: string }) => {
        const thread = await this.loadThread(input.conversationId);
        if (thread.length === 0) {
          throw new Error('No messages to extract contact info from');
        }

        const raw = await this.commsAiService.runPrompt(
          'Extract the customer\'s contact info from this conversation thread. Respond with ONLY a JSON object shaped exactly as {"firstName":string,"lastName":string,"email":string|null,"phone":string|null} — no other text. Use null for anything not mentioned. If you cannot identify a name at all, use "Unknown" for firstName and lastName.',
          thread,
        );

        let extracted: {
          firstName: string;
          lastName: string;
          email?: string | null;
          phone?: string | null;
        };
        try {
          extracted = JSON.parse(raw) as typeof extracted;
        } catch {
          throw new Error('Could not extract structured contact info from this conversation');
        }

        const contact = await this.contactsService.create({
          firstName: extracted.firstName || 'Unknown',
          lastName: extracted.lastName || 'Unknown',
          email: extracted.email ?? undefined,
          phone: extracted.phone ?? undefined,
          notes: `Created from communications conversation ${input.conversationId}`,
        });

        return {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
        };
      },
      ground(_input, output) {
        const data = output as { id: string; firstName: string; lastName: string };
        const label = `${data.firstName} ${data.lastName}`.trim();
        return {
          summary: `Created contact — ${label}`,
          records: [{ type: 'sales.contact', id: data.id, label }],
          events: [
            {
              description: `Created contact from the conversation: ${label}`,
              recordType: 'sales.contact',
              recordId: data.id,
            },
          ],
        };
      },
    };
  }
}
