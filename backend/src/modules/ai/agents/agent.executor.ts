import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageResponseDto } from '../conversations/dto/conversation.dto';
import { ConversationRepository } from '../conversations/conversation.repository';
import { MessageEntity } from '../conversations/entities/message.entity';
import { MemoryService } from '../memory/memory.service';
import { AIMessage } from '../models/ai-model.types';
import { AIRuntimeService } from '../runtime/ai-runtime.service';
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
    private readonly aiRuntimeService: AIRuntimeService,
    private readonly conversationRepository: ConversationRepository,
    private readonly memoryService: MemoryService,
    private readonly agentFactory: AgentFactory,
  ) {}

  async execute(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    dto: RunAgentDto,
  ): Promise<AgentExecutionResult> {
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

    for (const toolRequest of dto.toolRequests ?? []) {
      if (allowedToolNames.length > 0 && !allowedToolNames.includes(toolRequest.toolName)) {
        throw new BadRequestException(
          `Tool "${toolRequest.toolName}" is not allowed for agent "${agent.name}"`,
        );
      }

      const toolResponse = await this.aiRuntimeService.executeTool({
        conversationId: dto.conversationId,
        toolName: toolRequest.toolName,
        input: toolRequest.input,
        timeoutMs: toolRequest.timeoutMs,
        retries: toolRequest.retries,
      });
      toolResponses.push(toolResponse);
    }

    const toolResults = toolResponses.map((response) => response.result);
    const toolMessages = toolResponses.map((response) => response.message);

    let outputText = '';
    let finishReason: string | undefined;
    let tokenUsage: Record<string, unknown> = {};
    let providerUsed = agent.provider;
    let modelUsed = agent.model;

    for await (const event of this.aiRuntimeService.streamChat(
      this.agentFactory.buildRuntimeInput({
        agent,
        run: dto,
        conversationHistory: history.map(toAIMessage),
        toolResults,
      }),
    )) {
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

function toAIMessage(message: MessageEntity): AIMessage {
  return {
    role: message.role,
    content: message.content,
    ...(typeof message.metadata.toolName === 'string' ? { name: message.metadata.toolName } : {}),
  };
}

function toUsageRecord(usage: unknown): Record<string, unknown> {
  return typeof usage === 'object' && usage !== null && !Array.isArray(usage)
    ? (usage as Record<string, unknown>)
    : {};
}
