import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentService } from '../../attachments/attachment.service';
import { AuditService } from '../../audit/audit.service';
import { AIGatewayService } from '../gateway/ai-gateway.service';
import { AiGatewayStreamEvent } from '../gateway/ai-gateway-stream-event.types';
import { MemoryService } from '../memory/memory.service';
import { AIMessage, AIProviderName } from '../models/ai-model.types';
import { ModelRegistryService } from '../models/model-registry.service';
import { drainToReturnValue, isAbortError } from '../streaming/drain-generator';
import {
  ConversationRepository,
  PaginatedConversations,
  PaginatedMessages,
} from './conversation.repository';
import {
  CreateConversationDto,
  CreateConversationMessageResponseDto,
  CreateMessageDto,
  MessageResponseDto,
  PaginatedConversationsDto,
  PaginatedMessagesDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto/conversation.dto';
import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';

const DEFAULT_CONVERSATION_TITLE = 'New conversation';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly memoryService: MemoryService,
    private readonly auditService: AuditService,
    private readonly attachmentService: AttachmentService,
  ) {}

  async createConversation(dto: CreateConversationDto): Promise<ConversationResponseDto> {
    const { model, provider } = await this.resolveConversationProviderAndModel(dto);

    const entity = await this.conversationRepository.createConversation({
      title: normalizeConversationTitle(dto.title),
      model,
      provider,
      pinned: dto.pinned,
      archived: dto.archived,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'ai_conversation',
      resourceId: entity.id,
      metadata: {
        model: entity.model,
        provider: entity.provider,
      },
    });

    return ConversationResponseDto.fromEntity(entity);
  }

  async listConversations(query: {
    page: number;
    limit: number;
    search?: string;
    pinned?: boolean;
    archived?: boolean;
  }): Promise<PaginatedConversationsDto> {
    const result = await this.conversationRepository.findAllConversations(query);
    return toPaginatedConversationsDto(result);
  }

  async getConversation(id: string): Promise<ConversationResponseDto> {
    const entity = await this.getConversationOrThrow(id);
    return ConversationResponseDto.fromEntity(entity);
  }

  async updateConversation(
    id: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    const updated = await this.conversationRepository.updateConversation(id, {
      ...(dto.title !== undefined ? { title: normalizeConversationTitle(dto.title) } : {}),
      ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
      ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
    });

    if (!updated) {
      throw new NotFoundException(`Conversation with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'ai_conversation',
      resourceId: updated.id,
      metadata: dto as Record<string, unknown>,
    });

    return ConversationResponseDto.fromEntity(updated);
  }

  async deleteConversation(id: string): Promise<ConversationResponseDto> {
    const deleted = await this.conversationRepository.softDeleteConversation(id);
    if (!deleted) {
      throw new NotFoundException(`Conversation with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'ai_conversation',
      resourceId: deleted.id,
    });

    return ConversationResponseDto.fromEntity(deleted);
  }

  async createMessage(
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<CreateConversationMessageResponseDto> {
    return drainToReturnValue(this.streamMessageTurn(conversationId, dto));
  }

  /**
   * Same conversation-turn logic as createMessage, expressed as a generator
   * so it can be consumed either by draining it for a single JSON response
   * (createMessage, unchanged external behavior) or by streaming each
   * yielded event live over SSE (the new streaming endpoint). There is
   * exactly one implementation of this turn's persistence and orchestration
   * — the two entry points differ only in how they consume it.
   */
  async *streamMessageTurn(
    conversationId: string,
    dto: CreateMessageDto,
    signal?: AbortSignal,
  ): AsyncGenerator<AiGatewayStreamEvent, CreateConversationMessageResponseDto> {
    if (dto.content.trim().length === 0 && !dto.attachmentIds?.length) {
      throw new BadRequestException('Message must include text or at least one attachment');
    }

    yield { type: 'status', status: 'queued' };

    const conversation = await this.getConversationOrThrow(conversationId);
    const history =
      await this.conversationRepository.findAllMessagesForConversation(conversationId);

    yield { type: 'status', status: 'processing' };

    const userMessage = await this.conversationRepository.createMessage({
      conversationId,
      role: 'USER',
      content: dto.content.trim(),
    });

    if (dto.attachmentIds?.length) {
      await Promise.all(
        dto.attachmentIds.map((attachmentId) =>
          this.attachmentService.addReference(attachmentId, 'AI_MESSAGE', userMessage.id),
        ),
      );
    }

    const toolMessages = dto.toolResults
      ? await Promise.all(
          dto.toolResults.map((toolResult) =>
            this.conversationRepository.createMessage({
              conversationId,
              role: 'TOOL',
              content: toolResult.content.trim(),
              metadata: {
                toolName: toolResult.toolName.trim(),
                isError: toolResult.isError ?? false,
              },
            }),
          ),
        )
      : [];

    const generatedTitle = maybeGenerateTitle(conversation, dto.content);
    if (generatedTitle) {
      await this.conversationRepository.updateConversation(conversationId, {
        title: generatedTitle,
      });
    }

    let assistantContent = '';
    let finishReason: string | undefined;
    let tokenUsage: Record<string, unknown> = {};
    let providerUsed = conversation.provider;
    let modelUsed = conversation.model;

    yield { type: 'status', status: 'streaming' };

    try {
      for await (const event of this.aiGatewayService.streamChat({
        requestType: 'CONVERSATION_MESSAGE',
        conversationId,
        provider: conversation.provider as AIProviderName,
        model: conversation.model,
        conversationHistory: history.map(toAIMessage),
        userPrompt: dto.content,
        attachmentIds: dto.attachmentIds,
        systemPrompt: dto.systemPrompt,
        workspaceContext: dto.workspaceContext,
        toolResults: dto.toolResults,
        temperature: dto.temperature,
        maxOutputTokens: dto.maxOutputTokens,
        signal,
      })) {
        providerUsed = event.provider;
        modelUsed = event.model;

        if (event.type === 'content_delta') {
          assistantContent += event.delta;
        }

        if (event.type === 'message_end') {
          finishReason = event.finishReason;
          if (event.outputText && event.outputText.trim().length > 0) {
            assistantContent = event.outputText;
          }
          tokenUsage = toUsageRecord(event.usage);
        }

        yield { type: 'provider_event', event };
      }
    } catch (error) {
      yield { type: 'status', status: isAbortError(error) ? 'cancelled' : 'failed' };
      throw error;
    }

    const assistantMessage = assistantContent.trim().length
      ? await this.conversationRepository.createMessage({
          conversationId,
          role: 'ASSISTANT',
          content: assistantContent.trim(),
          metadata: {
            provider: providerUsed,
            model: modelUsed,
            ...(finishReason ? { finishReason } : {}),
          },
          tokenUsage,
        })
      : null;

    if (assistantMessage) {
      await this.memoryService.captureConversationMemories({
        conversationId,
        userContent: dto.content,
        assistantContent: assistantMessage.content,
        assistantMetadata: {
          provider: providerUsed,
          model: modelUsed,
          ...(finishReason ? { finishReason } : {}),
        },
      });

      await this.auditService.record({
        action: 'create',
        resource: 'ai_message',
        resourceId: assistantMessage.id,
        metadata: {
          conversationId,
          role: assistantMessage.role,
          provider: providerUsed,
          model: modelUsed,
        },
      });
    }

    yield { type: 'status', status: 'completed' };

    return {
      userMessage: MessageResponseDto.fromEntity(userMessage),
      toolMessages: toolMessages.map((message) => MessageResponseDto.fromEntity(message)),
      assistantMessage: assistantMessage ? MessageResponseDto.fromEntity(assistantMessage) : null,
    };
  }

  async listMessages(
    conversationId: string,
    query: { page: number; limit: number },
  ): Promise<PaginatedMessagesDto> {
    await this.getConversationOrThrow(conversationId);
    const result = await this.conversationRepository.findMessages(conversationId, query);
    return toPaginatedMessagesDto(result);
  }

  private async getConversationOrThrow(id: string): Promise<ConversationEntity> {
    const entity = await this.conversationRepository.findConversationById(id);
    if (!entity) {
      throw new NotFoundException(`Conversation with id "${id}" not found`);
    }

    return entity;
  }

  private async resolveConversationProviderAndModel(dto: CreateConversationDto): Promise<{
    provider: string;
    model: string;
  }> {
    if (dto.provider && dto.model) {
      return {
        provider: dto.provider,
        model: dto.model,
      };
    }

    const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
      dto.provider,
      dto.model,
      'chat',
    );

    return {
      provider: provider.name,
      model: model.id,
    };
  }
}

function normalizeConversationTitle(title?: string): string {
  const normalized = title?.trim();
  return normalized && normalized.length > 0
    ? normalized.slice(0, 200)
    : DEFAULT_CONVERSATION_TITLE;
}

function maybeGenerateTitle(conversation: ConversationEntity, prompt: string): string | null {
  if (conversation.title !== DEFAULT_CONVERSATION_TITLE) {
    return null;
  }

  const normalized = prompt.replace(/\s+/gu, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trimEnd()}...`;
}

function toPaginatedConversationsDto(result: PaginatedConversations): PaginatedConversationsDto {
  return {
    items: result.items.map((item) => ConversationResponseDto.fromEntity(item)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

function toPaginatedMessagesDto(result: PaginatedMessages): PaginatedMessagesDto {
  return {
    items: result.items.map((item) => MessageResponseDto.fromEntity(item)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
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
