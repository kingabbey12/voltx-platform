import { Injectable } from '@nestjs/common';
import { MemoryEntity } from '../memory/entities/memory.entity';
import { AIContentPart, AIMessage } from '../models/ai-model.types';
import { messageContentToText } from '../providers/provider-http.utils';
import { ToolResult } from '../tools/tool-result.types';
import { DEFAULT_SYSTEM_PROMPT } from './default-system-prompt';

export interface PromptBuildInput {
  systemPrompt?: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  relevantMemories?: MemoryEntity[];
  userPrompt: string;
  toolResults?: ToolResult[];
  /** Content parts (images, extracted document text) resolved from attachmentIds — appended to the current turn's user message only, never persisted into history as an array. */
  attachmentContentParts?: AIContentPart[];
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
        content: buildUserContent(input.userPrompt.trim(), input.attachmentContentParts),
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

  // History loaded from the database is always plain text (attachments are
  // never persisted as multimodal content — see PromptBuildInput's doc
  // comment), but the type covers both, so normalize defensively.
  return history
    .map((message) => ({
      role: message.role,
      content: messageContentToText(message.content).trim(),
      ...(message.name ? { name: message.name.trim() } : {}),
    }))
    .filter((message) => message.content.length > 0);
}

function buildUserContent(
  text: string,
  attachmentContentParts: AIContentPart[] | undefined,
): string | AIContentPart[] {
  if (!attachmentContentParts || attachmentContentParts.length === 0) {
    return text;
  }
  // Omit an empty text part for attachment-only messages (no caption)
  // rather than sending providers a blank {type:'text', text:''} block.
  return text.length > 0
    ? [...attachmentContentParts, { type: 'text', text }]
    : attachmentContentParts;
}
