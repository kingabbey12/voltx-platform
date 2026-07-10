import { Injectable, Logger } from '@nestjs/common';
import { ConversationService as AiConversationService } from '../../conversations/conversation.service';
import { extractJsonObject } from '../autonomous/extract-json-object';
import { AgentRepository } from '../agent.repository';
import { AgentService } from '../agent.service';
import { AiSuggestionEntity, AiSuggestionCategory } from '../entities/ai-suggestion.entity';
import { AiSuggestionRepository } from './ai-suggestion.repository';

const EXECUTIVE_ASSISTANT_NAME = 'Executive Assistant';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const VALID_CATEGORIES: AiSuggestionCategory[] = [
  'SALES',
  'SUPPORT',
  'OPERATIONS',
  'FINANCE',
  'GENERAL',
];

const SUGGESTIONS_PROMPT =
  "Review this organization's recent sales pipeline, support, and operational activity, then propose exactly 3 concrete, actionable suggestions for the team. " +
  'Respond with ONLY a JSON object shaped exactly as {"suggestions": [{"category": "SALES"|"SUPPORT"|"OPERATIONS"|"FINANCE"|"GENERAL", "title": string, "description": string}]} — no other text.';

/**
 * Proactive suggestions for the AI Operator dashboard. Generated on-demand
 * with a time-based cache (regenerate only once the newest active
 * suggestion set is stale) rather than a separate scheduled sweep —
 * bounded, real, and avoids a second per-org iteration job alongside the
 * approval-resume queue. Mirrors CommsAiService.runPrompt's "spin up a
 * throwaway conversation, run a named system agent, return its text"
 * pattern for the same reason: a bounded task-specific AI call, not a
 * chat the user sees.
 */
@Injectable()
export class AiSuggestionService {
  private readonly logger = new Logger(AiSuggestionService.name);

  constructor(
    private readonly aiSuggestionRepository: AiSuggestionRepository,
    private readonly agentRepository: AgentRepository,
    private readonly agentService: AgentService,
    private readonly aiConversationService: AiConversationService,
  ) {}

  async getOrGenerate(): Promise<AiSuggestionEntity[]> {
    const active = await this.aiSuggestionRepository.listActive();
    const newest = active[0];
    const isStale = !newest || Date.now() - newest.createdAt.getTime() > STALE_AFTER_MS;

    if (!isStale) {
      return active;
    }

    try {
      await this.generate();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to generate AI suggestions; returning existing set',
      );
    }

    return this.aiSuggestionRepository.listActive();
  }

  async dismiss(id: string): Promise<void> {
    await this.aiSuggestionRepository.dismiss(id);
  }

  private async generate(): Promise<void> {
    const agent = await this.agentRepository.findAgentByName(EXECUTIVE_ASSISTANT_NAME);
    if (!agent) {
      this.logger.warn('Executive Assistant agent not found; skipping suggestion generation');
      return;
    }

    const conversation = await this.aiConversationService.createConversation({
      title: 'AI Operator suggestions',
      provider: agent.provider,
      model: agent.model,
    });

    const result = await this.agentService.runAgent(agent.id, {
      conversationId: conversation.id,
      prompt: SUGGESTIONS_PROMPT,
    });

    const parsed = extractJsonObject(result.assistantMessage?.content ?? '');
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const valid = suggestions
      .filter(
        (item): item is { category: string; title: string; description: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).title === 'string' &&
          typeof (item as Record<string, unknown>).description === 'string',
      )
      .map((item) => ({
        category: VALID_CATEGORIES.includes(item.category as AiSuggestionCategory)
          ? (item.category as AiSuggestionCategory)
          : ('GENERAL' as const),
        title: item.title,
        description: item.description,
      }));

    if (valid.length > 0) {
      await this.aiSuggestionRepository.createMany(valid);
    }
  }
}
