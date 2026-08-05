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
    const history = normalizeHistory(input.conversationHistory);
    const systemPrompt = this.buildSystemPrompt(
      input.systemPrompt,
      input.workspaceContext,
      input.relevantMemories,
      [...history.toolContext, ...normalizeToolResults(input.toolResults)],
    );

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    messages.push(...history.messages, {
      role: 'user',
      content: buildUserContent(input.userPrompt.trim(), input.attachmentContentParts),
    });

    return Promise.resolve(messages);
  }

  private buildSystemPrompt(
    systemPrompt?: string,
    workspaceContext?: string[],
    relevantMemories?: MemoryEntity[],
    toolContext: string[] = [],
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

    if (toolContext.length > 0) {
      sections.push(['Pre-executed Tool Results:', ...toolContext].join('\n\n'));
    }

    return sections.join('\n\n');
  }
}

function normalizeHistory(history: AIMessage[] | undefined): {
  messages: AIMessage[];
  toolContext: string[];
} {
  if (!history) {
    return { messages: [], toolContext: [] };
  }

  // History loaded from the database is always plain text (attachments are
  // never persisted as multimodal content — see PromptBuildInput's doc
  // comment), but the type covers both, so normalize defensively. Tool
  // messages persisted by Voltx are pre-executed results, not responses to
  // native model tool_calls. Sending them as standalone `tool` role messages
  // makes OpenAI-compatible APIs reject the entire request, so carry them in
  // trusted system context instead.
  const messages: AIMessage[] = [];
  const toolContext: string[] = [];

  for (const message of history) {
    const content = messageContentToText(message.content).trim();
    if (content.length === 0) {
      continue;
    }

    if (message.role === 'tool') {
      const name = message.name?.trim() || 'historical_tool';
      toolContext.push(formatToolContext(name, content));
      continue;
    }

    messages.push({
      role: message.role,
      content,
      ...(message.name ? { name: message.name.trim() } : {}),
    });
  }

  return { messages, toolContext };
}

function normalizeToolResults(toolResults: ToolResult[] | undefined): string[] {
  if (!toolResults) {
    return [];
  }

  return toolResults
    .map((toolResult) => ({
      name: toolResult.toolName.trim(),
      content: toolResult.content.trim(),
      status: toolResult.isError ? 'error' : 'success',
    }))
    .filter((toolResult) => toolResult.name.length > 0 && toolResult.content.length > 0)
    .map((toolResult) => formatToolContext(toolResult.name, toolResult.content, toolResult.status));
}

function formatToolContext(name: string, content: string, status = 'recorded'): string {
  return [`Tool: ${name}`, `Status: ${status}`, content].join('\n');
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
