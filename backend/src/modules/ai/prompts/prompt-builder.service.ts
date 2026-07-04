import { Injectable } from '@nestjs/common';
import { ConversationMemoryService } from '../memory/conversation-memory.service';
import { AIMessage } from '../models/ai-model.types';
import { ToolResult } from '../tools/tool-result.types';
import { DEFAULT_SYSTEM_PROMPT } from './default-system-prompt';

export interface PromptBuildInput {
  systemPrompt?: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  userPrompt: string;
  toolResults?: ToolResult[];
}

@Injectable()
export class PromptBuilderService {
  constructor(private readonly conversationMemoryService: ConversationMemoryService) {}

  build(input: PromptBuildInput): AIMessage[] {
    const messages: AIMessage[] = [];
    const systemPrompt = this.buildSystemPrompt(input.systemPrompt, input.workspaceContext);

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    messages.push(
      ...this.conversationMemoryService.normalizeHistory(input.conversationHistory),
      ...this.buildToolMessages(input.toolResults),
      {
        role: 'user',
        content: input.userPrompt.trim(),
      },
    );

    return messages;
  }

  private buildSystemPrompt(systemPrompt?: string, workspaceContext?: string[]): string {
    const sections = [systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT];
    const normalizedWorkspaceContext = (workspaceContext ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (normalizedWorkspaceContext.length > 0) {
      sections.push(
        ['Workspace Context:', ...normalizedWorkspaceContext.map((item) => `- ${item}`)].join('\n'),
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
