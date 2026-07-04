import { Injectable } from '@nestjs/common';
import { MemoryEntity } from '../memory/entities/memory.entity';
import { AIMessage } from '../models/ai-model.types';
import { ToolResult } from '../tools/tool-result.types';
import { DEFAULT_SYSTEM_PROMPT } from './default-system-prompt';

export interface PromptBuildInput {
  systemPrompt?: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  relevantMemories?: MemoryEntity[];
  userPrompt: string;
  toolResults?: ToolResult[];
}

@Injectable()
export class PromptBuilderService {
  build(input: PromptBuildInput): Promise<AIMessage[]> {
    const messages: AIMessage[] = [];
    const systemPrompt = this.buildSystemPrompt(
      input.systemPrompt,
      input.workspaceContext,
      input.relevantMemories,
    );

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    messages.push(
      ...normalizeHistory(input.conversationHistory),
      ...this.buildToolMessages(input.toolResults),
      {
        role: 'user',
        content: input.userPrompt.trim(),
      },
    );

    return Promise.resolve(messages);
  }

  private buildSystemPrompt(
    systemPrompt?: string,
    workspaceContext?: string[],
    relevantMemories?: MemoryEntity[],
  ): string {
    const sections = [systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT];
    const normalizedWorkspaceContext = (workspaceContext ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (normalizedWorkspaceContext.length > 0) {
      sections.push(
        ['Workspace Context:', ...normalizedWorkspaceContext.map((item) => `- ${item}`)].join('\n'),
      );
    }

    const normalizedMemories = (relevantMemories ?? []).filter(
      (memory) => memory.content.trim().length > 0,
    );
    if (normalizedMemories.length > 0) {
      sections.push(
        [
          'Relevant Memories:',
          ...normalizedMemories.map(
            (memory) =>
              `- [${memory.category}] ${memory.content.trim()} (importance: ${memory.importance.toFixed(2)})`,
          ),
        ].join('\n'),
      );
    }

    return sections.join('\n\n');
  }

  private buildToolMessages(toolResults?: ToolResult[]): AIMessage[] {
    if (!toolResults) {
      return [];
    }

    return toolResults
      .map((toolResult) => ({
        role: 'tool' as const,
        name: toolResult.toolName.trim(),
        content: [
          `Tool: ${toolResult.toolName.trim()}`,
          `Status: ${toolResult.isError ? 'error' : 'success'}`,
          toolResult.content.trim(),
        ].join('\n'),
      }))
      .filter((message) => message.name.length > 0 && message.content.trim().length > 0);
  }
}

function normalizeHistory(history: AIMessage[] | undefined): AIMessage[] {
  if (!history) {
    return [];
  }

  return history
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
      ...(message.name ? { name: message.name.trim() } : {}),
    }))
    .filter((message) => message.content.length > 0);
}
