import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { ContactsService } from '../../sales/contacts/contacts.service';
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
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [this.buildSummarizeTool(), this.buildDraftReplyTool(), this.buildExtractContactTool()];
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
    };
  }
}
