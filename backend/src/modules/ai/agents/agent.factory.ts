import { Injectable } from '@nestjs/common';
import { MessageResponseDto } from '../conversations/dto/conversation.dto';
import { AIMessage, AIRuntimeChatInput, AIProviderName } from '../models/ai-model.types';
import { ToolResult } from '../tools/tool-result.types';
import { RunAgentDto } from './dto/agent.dto';
import { AgentConfiguration, AgentEntity } from './entities/agent.entity';

export interface SystemAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  provider: AIProviderName;
  model: string;
  configuration: AgentConfiguration & Record<string, unknown>;
  enabled: boolean;
}

@Injectable()
export class AgentFactory {
  createSystemAgents(provider: AIProviderName, model: string): SystemAgentDefinition[] {
    return [
      {
        name: 'Executive Assistant',
        description: 'Delivers concise executive-ready summaries, risks, and recommendations.',
        systemPrompt:
          'You are the Executive Assistant for Voltx leadership. Produce concise, actionable, high-signal outputs for executives. Prioritize business impact, risks, decisions, and recommended next steps.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'executive_assistant',
          toolNames: ['calculator', 'datetime', 'http_get', 'json'],
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
        enabled: true,
      },
      {
        name: 'Research Analyst',
        description: 'Investigates topics, synthesizes findings, and cites evidence clearly.',
        systemPrompt:
          'You are the Research Analyst for Voltx. Investigate thoroughly, compare options objectively, and synthesize findings into clear recommendations with explicit assumptions.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'research_analyst',
          toolNames: ['datetime', 'http_get', 'http_post', 'json'],
          temperature: 0.3,
          maxOutputTokens: 3072,
        },
        enabled: true,
      },
      {
        name: 'Sales Assistant',
        description: 'Drafts outreach, summarizes accounts, and recommends sales actions.',
        systemPrompt:
          'You are the Sales Assistant for Voltx. Write clear customer-facing drafts, summarize account context, and recommend concrete sales next steps.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'sales_assistant',
          toolNames: ['datetime', 'json', 'uuid'],
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
        enabled: true,
      },
      {
        name: 'Customer Support',
        description: 'Resolves customer issues with empathy, clarity, and operational precision.',
        systemPrompt:
          'You are the Customer Support agent for Voltx. Be empathetic, concise, and operationally precise. Focus on resolution steps, impact, and escalation guidance.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'customer_support',
          toolNames: ['datetime', 'http_get', 'json'],
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
        enabled: true,
      },
      {
        name: 'Operations Assistant',
        description: 'Supports operational workflows, status checks, and process recommendations.',
        systemPrompt:
          'You are the Operations Assistant for Voltx. Optimize for reliability, clear procedures, operational awareness, and step-by-step execution guidance.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'operations_assistant',
          toolNames: ['calculator', 'datetime', 'http_get', 'json'],
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
        enabled: true,
      },
    ];
  }

  buildRuntimeInput(params: {
    agent: AgentEntity;
    run: RunAgentDto;
    conversationHistory: AIMessage[];
    toolResults: ToolResult[];
  }): AIRuntimeChatInput {
    const { agent, run, conversationHistory, toolResults } = params;
    const configuration = this.getConfiguration(agent);
    const systemPrompt = this.buildSystemPrompt(agent, configuration, params.toolResults);

    return {
      conversationId: run.conversationId,
      provider: agent.provider,
      model: agent.model,
      systemPrompt,
      workspaceContext: run.workspaceContext,
      conversationHistory,
      userPrompt: run.prompt.trim(),
      toolResults,
      temperature: run.temperature ?? configuration.temperature,
      maxOutputTokens: run.maxOutputTokens ?? configuration.maxOutputTokens,
    };
  }

  getAllowedToolNames(agent: AgentEntity): string[] {
    const configuration = this.getConfiguration(agent);
    return Array.isArray(configuration.toolNames)
      ? configuration.toolNames.filter((item): item is string => typeof item === 'string')
      : [];
  }

  buildRunOutput(params: {
    outputText: string;
    finishReason?: string;
    toolResults: ToolResult[];
    assistantMessage: MessageResponseDto | null;
  }): Record<string, unknown> {
    return {
      outputText: params.outputText,
      ...(params.finishReason ? { finishReason: params.finishReason } : {}),
      toolResults: params.toolResults.map((toolResult) => ({
        toolName: toolResult.toolName,
        content: toolResult.content,
        isError: toolResult.isError ?? false,
      })),
      ...(params.assistantMessage ? { assistantMessageId: params.assistantMessage.id } : {}),
    };
  }

  private buildSystemPrompt(
    agent: AgentEntity,
    configuration: AgentConfiguration & Record<string, unknown>,
    toolResults: ToolResult[],
  ): string {
    const sections = [agent.systemPrompt.trim()];

    if (agent.description.trim().length > 0) {
      sections.unshift(`Agent Role: ${agent.description.trim()}`);
    }

    const allowedTools = this.getAllowedToolNames(agent);
    if (allowedTools.length > 0) {
      sections.push(`Available Tools: ${allowedTools.join(', ')}`);
    }

    if (toolResults.length > 0) {
      sections.push(
        'Tool results may already be provided in the conversation context. Use them directly.',
      );
    }

    if (configuration.kind === 'system' && typeof configuration.systemAgentKey === 'string') {
      sections.push(`System Agent Key: ${configuration.systemAgentKey}`);
    }

    return sections.join('\n\n');
  }

  private getConfiguration(agent: AgentEntity): AgentConfiguration & Record<string, unknown> {
    return agent.configuration ?? {};
  }
}
