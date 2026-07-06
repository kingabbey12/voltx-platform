import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageResponseDto } from '../conversations/dto/conversation.dto';
import { ConversationRepository } from '../conversations/conversation.repository';
import { toAIMessage } from '../conversations/to-ai-message';
import { AIGatewayService } from '../gateway/ai-gateway.service';
import { AiGatewayStreamEvent } from '../gateway/ai-gateway-stream-event.types';
import { MemoryService } from '../memory/memory.service';
import { isAbortError } from '../streaming/drain-generator';
import { ExecuteToolResponse } from '../tools/tool.service';
import { ToolResult } from '../tools/tool-result.types';
import { AgentFactory } from './agent.factory';
import { RunAgentDto } from './dto/agent.dto';
import { AgentEntity } from './entities/agent.entity';
import { AgentRunEntity } from './entities/agent-run.entity';

export interface AgentExecutionResult {
  outputText: string;
  finishReason?: string;
  tokenUsage: Record<string, unknown>;
  userMessage: MessageResponseDto;
  toolMessages: MessageResponseDto[];
  assistantMessage: MessageResponseDto | null;
  toolResults: ToolResult[];
}

@Injectable()
export class AgentExecutor {
  constructor(
    private readonly aiGatewayService: AIGatewayService,
    private readonly conversationRepository: ConversationRepository,
    private readonly memoryService: MemoryService,
    private readonly agentFactory: AgentFactory,
  ) {}

  /**
   * Runs one agent turn (tool loop + chat completion + persistence +
   * memory capture) as a generator, yielding orchestration events along the
   * way. AgentService.runAgent drains this for its existing JSON response;
   * AgentService.runAgentStream re-yields it live over SSE — one
   * implementation of the turn, two consumption modes.
   */
  async *executeStream(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    dto: RunAgentDto,
    grantedPermissions: string[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<AiGatewayStreamEvent, AgentExecutionResult> {
    const conversation = await this.conversationRepository.findConversationById(dto.conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with id "${dto.conversationId}" not found`);
    }

    const history = await this.conversationRepository.findAllMessagesForConversation(
      dto.conversationId,
    );
    const userMessage = await this.conversationRepository.createMessage({
      conversationId: dto.conversationId,
      role: 'USER',
      content: dto.prompt.trim(),
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        agentRunId: agentRun.id,
      },
    });

    const toolResponses: ExecuteToolResponse[] = [];
    const allowedToolNames = this.agentFactory.getAllowedToolNames(agent);

    if ((dto.toolRequests ?? []).length > 0) {
      yield { type: 'reasoning', stage: 'planning', message: 'Planning...' };
    }

    for (const toolRequest of dto.toolRequests ?? []) {
      if (allowedToolNames.length > 0 && !allowedToolNames.includes(toolRequest.toolName)) {
        throw new BadRequestException(
          `Tool "${toolRequest.toolName}" is not allowed for agent "${agent.name}"`,
        );
      }

      yield { type: 'reasoning', stage: 'executing_tool', message: 'Executing Tool...' };
      yield { type: 'tool_call_start', toolName: toolRequest.toolName };

      try {
        const toolResponse = await this.aiGatewayService.executeTool(
          {
            conversationId: dto.conversationId,
            toolName: toolRequest.toolName,
            input: toolRequest.input,
            timeoutMs: toolRequest.timeoutMs,
            retries: toolRequest.retries,
            signal,
          },
          {
            agentId: agent.id,
            agentRunId: agentRun.id,
            grantedPermissions,
          },
        );
        toolResponses.push(toolResponse);
        yield {
          type: 'tool_call_result',
          toolName: toolRequest.toolName,
          durationMs: toolResponse.execution.durationMs ?? 0,
        };
      } catch (error) {
        yield {
          type: 'tool_call_error',
          toolName: toolRequest.toolName,
          message: error instanceof Error ? error.message : 'Tool execution failed',
        };
        throw error;
      }
    }

    const toolResults = toolResponses.map((response) => response.result);
    const toolMessages = toolResponses.map((response) => response.message);

    let outputText = '';
    let finishReason: string | undefined;
    let tokenUsage: Record<string, unknown> = {};
    let providerUsed = agent.provider;
    let modelUsed = agent.model;

    yield { type: 'reasoning', stage: 'finalizing', message: 'Finalizing Response...' };
    yield { type: 'status', status: 'streaming' };

    try {
      for await (const event of this.aiGatewayService.streamChat({
        requestType: 'AGENT_RUN',
        agentId: agent.id,
        agentRunId: agentRun.id,
        ...this.agentFactory.buildRuntimeInput({
          agent,
          run: dto,
          conversationHistory: history.map(toAIMessage),
          toolResults,
        }),
        signal,
      })) {
        providerUsed = event.provider;
        modelUsed = event.model;

        if (event.type === 'content_delta') {
          outputText += event.delta;
        }

        if (event.type === 'message_end') {
          finishReason = event.finishReason;
          if (event.outputText && event.outputText.trim().length > 0) {
            outputText = event.outputText;
          }
          tokenUsage = toUsageRecord(event.usage);
        }

        yield { type: 'provider_event', event };
      }
    } catch (error) {
      yield { type: 'status', status: isAbortError(error) ? 'cancelled' : 'failed' };
      throw error;
    }

    const assistantMessage =
      outputText.trim().length > 0
        ? await this.conversationRepository.createMessage({
            conversationId: dto.conversationId,
            role: 'ASSISTANT',
            content: outputText.trim(),
            metadata: {
              provider: providerUsed,
              model: modelUsed,
              agentId: agent.id,
              agentName: agent.name,
              agentRunId: agentRun.id,
              ...(finishReason ? { finishReason } : {}),
            },
            tokenUsage,
          })
        : null;

    if (assistantMessage) {
      await this.memoryService.captureConversationMemories({
        conversationId: dto.conversationId,
        userContent: dto.prompt,
        assistantContent: assistantMessage.content,
        assistantMetadata: {
          provider: providerUsed,
          model: modelUsed,
          agentId: agent.id,
          agentRunId: agentRun.id,
          ...(finishReason ? { finishReason } : {}),
        },
      });
    }

    return {
      outputText: outputText.trim(),
      finishReason,
      tokenUsage,
      userMessage: MessageResponseDto.fromEntity(userMessage),
      toolMessages,
      assistantMessage: assistantMessage ? MessageResponseDto.fromEntity(assistantMessage) : null,
      toolResults,
    };
  }
}

function toUsageRecord(usage: unknown): Record<string, unknown> {
  return typeof usage === 'object' && usage !== null && !Array.isArray(usage)
    ? (usage as Record<string, unknown>)
    : {};
}
