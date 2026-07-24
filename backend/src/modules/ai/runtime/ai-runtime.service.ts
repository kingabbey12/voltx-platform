import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentContentBuilderService } from '../../attachments/attachment-content-builder.service';
import { ModelRegistryService } from '../models/model-registry.service';
import {
  AIChatResponse,
  AIEmbeddingResponse,
  AIRuntimeChatInput,
  AIModelDefinition,
  AIProviderChatRequest,
  AIStreamEvent,
  CredentialSource,
} from '../models/ai-model.types';
import { PromptBuilderService } from '../prompts/prompt-builder.service';
import { AIProvider, AIProviderError, AI_PROVIDERS } from '../providers/ai-provider.interface';
import { MemoryService } from '../memory/memory.service';
import { ExecuteToolRequest, ExecuteToolResponse, ToolService } from '../tools/tool.service';
import { TenantAiCredentialResolver } from '../credentials/tenant-ai-credential-resolver.service';

@Injectable()
export class AIRuntimeService {
  private readonly logger = new Logger(AIRuntimeService.name);
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    @Inject(AI_PROVIDERS) private readonly providers: AIProvider[],
    private readonly modelRegistryService: ModelRegistryService,
    private readonly promptBuilderService: PromptBuilderService,
    @Inject(forwardRef(() => MemoryService))
    private readonly memoryService: MemoryService,
    private readonly toolService: ToolService,
    private readonly configService: ConfigService,
    private readonly attachmentContentBuilderService: AttachmentContentBuilderService,
    private readonly credentialResolver: TenantAiCredentialResolver,
  ) {
    this.maxRetries = configService.get<number>('ai.maxRetries', 2);
    this.retryBaseDelayMs = configService.get<number>('ai.retryBaseDelayMs', 250);
  }

  async chat(
    input: AIRuntimeChatInput,
  ): Promise<AIChatResponse & { credentialSource: CredentialSource }> {
    return this.executeWithRetries(async () => {
      const { provider, model, request, credentialSource } = await this.prepareChatRequest(input);
      const response = await provider.chat(request);

      return {
        ...response,
        provider: provider.name,
        model: model.id,
        credentialSource,
      };
    });
  }

  async *streamChat(input: AIRuntimeChatInput): AsyncIterable<AIStreamEvent> {
    const { provider, model, request, credentialSource } = await this.prepareChatRequest(input);

    let attempt = 0;

    while (true) {
      let yieldedOutput = false;

      try {
        for await (const event of provider.stream(request)) {
          yieldedOutput = yieldedOutput || event.type === 'content_delta';
          yield {
            ...event,
            provider: provider.name,
            model: model.id,
            ...(event.type === 'message_end' ? { credentialSource } : {}),
          };
        }
        return;
      } catch (error) {
        const retryable = this.isRetryableError(error);
        if (yieldedOutput || !retryable || attempt >= this.maxRetries) {
          throw error;
        }

        attempt += 1;
        this.logger.warn(
          {
            provider: provider.name,
            model: model.id,
            attempt,
          },
          'Retrying AI stream after provider error',
        );
        await delay(this.retryBaseDelayMs * attempt);
      }
    }
  }

  async embeddings(
    input: Pick<AIRuntimeChatInput, 'provider' | 'model' | 'signal' | 'organizationId'> & {
      input: string[];
    },
  ): Promise<AIEmbeddingResponse & { credentialSource: CredentialSource }> {
    return this.executeWithRetries(async () => {
      const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
        input.provider,
        input.model,
        'embeddings',
      );

      const credential = await this.credentialResolver.resolve(input.organizationId, provider.name);
      const credentialSource: CredentialSource = credential ? 'TENANT' : 'PLATFORM';

      const response = await provider.embeddings({
        model: model.id,
        input: input.input,
        signal: input.signal,
        credentialOverride: credential ?? undefined,
      });

      return {
        ...response,
        provider: provider.name,
        model: model.id,
        credentialSource,
      };
    });
  }

  async models(): Promise<AIModelDefinition[]> {
    return this.modelRegistryService.listModels();
  }

  async executeTool(request: ExecuteToolRequest): Promise<ExecuteToolResponse> {
    return this.toolService.executeTool(request);
  }

  private async prepareChatRequest(input: AIRuntimeChatInput): Promise<{
    provider: AIProvider;
    model: AIModelDefinition;
    request: AIProviderChatRequest;
    credentialSource: CredentialSource;
  }> {
    const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
      input.provider,
      input.model,
      'chat',
    );
    const relevantMemories = await this.memoryService.selectRelevantMemoriesForCompletion({
      conversationId: input.conversationId,
      userPrompt: input.userPrompt,
      workspaceContext: input.workspaceContext,
      conversationHistory: input.conversationHistory,
    });

    const attachmentContentParts = input.attachmentIds?.length
      ? await this.attachmentContentBuilderService.build(
          input.attachmentIds,
          model.supportsVision ?? false,
        )
      : undefined;

    const credential = await this.credentialResolver.resolve(input.organizationId, provider.name);
    const credentialSource: CredentialSource = credential ? 'TENANT' : 'PLATFORM';

    return {
      provider,
      model,
      request: {
        model: model.id,
        messages: await this.promptBuilderService.build({
          systemPrompt: input.systemPrompt,
          workspaceContext: input.workspaceContext,
          conversationHistory: input.conversationHistory,
          relevantMemories,
          userPrompt: input.userPrompt,
          toolResults: input.toolResults,
          attachmentContentParts,
        }),
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        signal: input.signal,
        credentialOverride: credential ?? undefined,
      },
      credentialSource,
    };
  }

  private async executeWithRetries<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        const retryable = this.isRetryableError(error);
        if (!retryable || attempt >= this.maxRetries) {
          throw error;
        }

        attempt += 1;
        await delay(this.retryBaseDelayMs * attempt);
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    return error instanceof AIProviderError && error.retryable;
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
