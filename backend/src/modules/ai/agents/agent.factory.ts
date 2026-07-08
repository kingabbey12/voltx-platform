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
        // Default agent for the AI Command Center — read/search tools
        // only. The Command Center starts every session against this
        // agent; mutating actions (create_task, create_simple_workflow)
        // are only reachable via "Voltx Operator" below, which the
        // frontend switches to solely after the user explicitly confirms
        // they want the AI to take real actions. Two agents rather than a
        // per-request tool override because RunAutonomousAgentDto has no
        // tool-restriction field — the agent's configured toolNames is the
        // only lever, so the confirmation gate has to be "which agent",
        // not "which tools this one call gets".
        name: 'Voltx Operator (Read-Only)',
        description: 'Searches CRM data and workflow history — cannot create or change anything.',
        systemPrompt:
          "You are the Voltx Operator, in read-only mode. You have real read access to this organization's CRM (companies, contacts, leads, opportunities, activities) and workflow run history. " +
          'Use your tools to answer with real data rather than guessing — search before you claim a fact about deals, tasks, or leads. ' +
          'You cannot create or change anything right now. If the user asks you to take an action (create a task, build a workflow), tell them to enable "Allow actions" first.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'voltx_operator_readonly',
          toolNames: [
            'datetime',
            'calculator',
            'json',
            'search_opportunities',
            'search_overdue_activities',
            'search_leads',
            'list_failed_workflow_runs',
          ],
          temperature: 0.15,
          maxOutputTokens: 3072,
        },
        enabled: true,
      },
      {
        // Full-capability counterpart — same brain, same read tools, plus
        // real mutating tools. Only ever invoked after explicit user
        // confirmation (see AiCommandCenter's confirm gate on the
        // frontend); never the default.
        name: 'Voltx Operator',
        description:
          'The workspace-wide operator behind the AI Command Center — searches CRM data, creates tasks, and drafts workflows across every module on request.',
        systemPrompt:
          "You are the Voltx Operator, an autonomous assistant with real read and write access to this organization's CRM (companies, contacts, leads, opportunities, activities) and workflows. " +
          'Use your tools to answer questions with real data rather than guessing — search before you claim a fact about deals, tasks, or leads. ' +
          'Before creating or changing anything (a task, a workflow), state your plan clearly in your reasoning so the user understands what you are about to do. ' +
          'Be concise, cite the concrete records/counts your tools returned, and never claim to have taken an action you did not actually call a tool for.',
        provider,
        model,
        configuration: {
          kind: 'system',
          systemAgentKey: 'voltx_operator',
          toolNames: [
            'datetime',
            'calculator',
            'json',
            'search_opportunities',
            'search_overdue_activities',
            'create_task',
            'search_leads',
            'create_simple_workflow',
            'list_failed_workflow_runs',
          ],
          temperature: 0.15,
          maxOutputTokens: 3072,
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

  /**
   * Whether this agent may delegate to other agents at all. Defaults to
   * true — delegation is a broadly available capability the model opts
   * into per-objective, not a per-agent feature flag, matching "do not
   * hardcode workflows."
   */
  canDelegate(agent: AgentEntity): boolean {
    const configuration = this.getConfiguration(agent);
    return configuration.canDelegate !== false;
  }

  /**
   * Empty/absent means unrestricted (may delegate to any enabled agent in
   * the organization), mirroring getAllowedToolNames's convention exactly.
   */
  getAllowedDelegateAgentNames(agent: AgentEntity): string[] {
    const configuration = this.getConfiguration(agent);
    return Array.isArray(configuration.delegateToAgentNames)
      ? configuration.delegateToAgentNames.filter(
          (item): item is string => typeof item === 'string',
        )
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
