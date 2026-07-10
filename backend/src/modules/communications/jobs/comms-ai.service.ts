import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentService } from '../../ai/agents/agent.service';
import { ConversationService as AiConversationService } from '../../ai/conversations/conversation.service';

const COMMUNICATIONS_ASSISTANT_NAME = 'Communications Assistant';

export interface CommsSummaryResult {
  summary: string;
  sentiment?: string;
  urgency?: string;
  intent?: string;
}

/**
 * Wires the Communications module into the existing AI agent/tool
 * system — same pattern as SalesModule's SalesAiService (find the named
 * system agent, spin up a throwaway AI conversation, run the agent with
 * a prompt + workspace context). Kept as its own service rather than
 * reusing SalesAiService directly since comms shouldn't depend on the
 * sales module for something this generic.
 */
@Injectable()
export class CommsAiService {
  constructor(
    private readonly agentService: AgentService,
    private readonly aiConversationService: AiConversationService,
  ) {}

  async summarizeConversation(workspaceContext: string[]): Promise<CommsSummaryResult> {
    const raw = await this.runPrompt(
      'Summarize this conversation thread and classify it. Respond with ONLY a JSON object shaped exactly as {"summary": string, "sentiment": "positive"|"neutral"|"negative", "urgency": "low"|"normal"|"high"|"urgent", "intent": string} — no other text.',
      workspaceContext,
      1000,
    );

    try {
      const parsed = JSON.parse(raw) as CommsSummaryResult;
      if (typeof parsed.summary === 'string' && parsed.summary.trim().length > 0) {
        return parsed;
      }
    } catch {
      // Model didn't return clean JSON — fall through to the honest raw-text fallback below.
    }

    return { summary: raw || 'Summary unavailable.' };
  }

  /**
   * General-purpose entry point for anything else the Communications
   * Assistant needs to do (draft a reply, extract structured contact
   * info) — takes an explicit prompt rather than hardcoding one, unlike
   * summarizeConversation above which is a thin wrapper around this for
   * its one fixed purpose. Returns the raw assistant text; callers parse
   * it however their prompt asked the model to shape it.
   */
  async runPrompt(
    prompt: string,
    workspaceContext: string[],
    maxOutputTokens?: number,
  ): Promise<string> {
    const agent = await this.agentService.findAgentByName(COMMUNICATIONS_ASSISTANT_NAME);
    if (!agent) {
      throw new NotFoundException(`Agent "${COMMUNICATIONS_ASSISTANT_NAME}" not found`);
    }

    const conversation = await this.aiConversationService.createConversation({
      title: 'Comms AI task',
      provider: agent.provider,
      model: agent.model,
    });

    const result = await this.agentService.runAgent(agent.id, {
      conversationId: conversation.id,
      prompt,
      workspaceContext,
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    });

    return result.assistantMessage?.content ?? '';
  }
}
