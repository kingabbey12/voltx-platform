import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelRegistryService } from '../models/model-registry.service';
import {
  AIChatResponse,
  AIEmbeddingResponse,
  AIRuntimeChatInput,
  AIModelDefinition,
  AIProviderChatRequest,
  AIStreamEvent,
} from '../models/ai-model.types';
import { PromptBuilderService } from '../prompts/prompt-builder.service';
import { AIProvider, AIProviderError, AI_PROVIDERS } from '../providers/ai-provider.interface';
import { ExecuteToolRequest, ExecuteToolResponse, ToolService } from '../tools/tool.service';

@Injectable()
export class AIRuntimeService {
  private readonly logger = new Logger(AIRuntimeService.name);
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    @Inject(AI_PROVIDERS) private readonly providers: AIProvider[],
    private readonly modelRegistryService: ModelRegistryService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly toolService: ToolService,
    private readonly configService: ConfigService,
  ) {
    this.maxRetries = configService.get<number>('ai.maxRetries', 2);
    this.retryBaseDelayMs = configService.get<number>('ai.retryBaseDelayMs', 250);
  }

  async chat(input: AIRuntimeChatInput): Promise<AIChatResponse> {
    return this.executeWithRetries(async () => {
      const { provider, model, request } = await this.prepareChatRequest(input);
      const response = await provider.chat(request);

      return {
        ...response,
        provider: provider.name,
        model: model.id,
      };
    });
  }

  async *streamChat(input: AIRuntimeChatInput): AsyncIterable<AIStreamEvent> {
    const { provider, model, request } = await this.prepareChatRequest(input);

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
    input: Pick<AIRuntimeChatInput, 'provider' | 'model' | 'signal'> & { input: string[] },
  ): Promise<AIEmbeddingResponse> {
    return this.executeWithRetries(async () => {
      const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
        input.provider,
        input.model,
        'embeddings',
      );

      const response = await provider.embeddings({
        model: model.id,
        input: input.input,
        signal: input.signal,
      });

      return {
        ...response,
        provider: provider.name,
        model: model.id,
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
  }> {
    const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
      input.provider,
      input.model,
      'chat',
    );

    return {
      provider,
      model,
      request: {
        model: model.id,
        messages: this.promptBuilderService.build({
          systemPrompt: input.systemPrompt,
          workspaceContext: input.workspaceContext,
          conversationHistory: input.conversationHistory,
          userPrompt: input.userPrompt,
          toolResults: input.toolResults,
        }),
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        signal: input.signal,
      },
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
