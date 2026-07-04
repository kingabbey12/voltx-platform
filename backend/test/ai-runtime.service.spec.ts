import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AIChatResponse,
  AIModelDefinition,
  AIStreamEvent,
} from '../src/modules/ai/models/ai-model.types';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { PromptBuilderService } from '../src/modules/ai/prompts/prompt-builder.service';
import { AI_PROVIDERS, AIProviderError } from '../src/modules/ai/providers/ai-provider.interface';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { ToolService } from '../src/modules/ai/tools/tool.service';

describe('AIRuntimeService', () => {
  let service: AIRuntimeService;
  let modelRegistryService: jest.Mocked<ModelRegistryService>;
  let promptBuilderService: jest.Mocked<PromptBuilderService>;

  const model: AIModelDefinition = {
    id: 'gpt-5-mini',
    provider: 'openai',
    family: 'gpt-5',
    displayName: 'GPT-5 Mini',
    supportsStreaming: true,
    supportsEmbeddings: false,
  };

  const provider = {
    name: 'openai' as const,
    chat: jest.fn<Promise<AIChatResponse>, []>(),
    stream: jest.fn<AsyncIterable<AIStreamEvent>, []>(),
    embeddings: jest.fn(),
    models: jest.fn(),
  };

  beforeEach(async () => {
    const modelRegistryMock = {
      resolveProviderAndModel: jest.fn().mockResolvedValue({
        provider,
        model,
      }),
      listModels: jest.fn().mockResolvedValue([model]),
    };

    const promptBuilderMock = {
      build: jest.fn().mockReturnValue([{ role: 'user', content: 'Hello world' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIRuntimeService,
        {
          provide: ModelRegistryService,
          useValue: modelRegistryMock,
        },
        {
          provide: PromptBuilderService,
          useValue: promptBuilderMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'ai.maxRetries') {
                return 2;
              }

              if (key === 'ai.retryBaseDelayMs') {
                return 1;
              }

              return fallback;
            }),
          },
        },
        {
          provide: ToolService,
          useValue: {
            executeTool: jest.fn(),
          },
        },
        {
          provide: AI_PROVIDERS,
          useValue: [provider],
        },
      ],
    }).compile();

    service = module.get(AIRuntimeService);
    modelRegistryService = module.get(ModelRegistryService);
    promptBuilderService = module.get(PromptBuilderService);
  });

  it('builds prompts and executes chat on the selected provider', async () => {
    provider.chat.mockResolvedValue({
      id: 'chat-1',
      provider: 'openai',
      model: 'gpt-5-mini',
      outputText: 'Hello back',
    });

    const result = await service.chat({
      userPrompt: 'Hello world',
      workspaceContext: ['Workspace: Voltx'],
    });

    expect(promptBuilderService.build).toHaveBeenCalled();
    expect(modelRegistryService.resolveProviderAndModel).toHaveBeenCalledWith(
      undefined,
      undefined,
      'chat',
    );
    expect(result.outputText).toBe('Hello back');
  });

  it('retries a retryable stream failure before succeeding', async () => {
    provider.stream
      .mockImplementationOnce(async function* failingStream() {
        await Promise.resolve();
        throw new AIProviderError('Temporary upstream failure', 'provider_request_failed', true);
        yield {
          type: 'error',
          provider: 'openai',
          model: 'gpt-5-mini',
          code: 'provider_request_failed',
          message: 'Temporary upstream failure',
        };
      })
      .mockImplementationOnce(async function* successfulStream() {
        await Promise.resolve();
        yield {
          type: 'message_start',
          provider: 'openai',
          model: 'gpt-5-mini',
          messageId: 'message-1',
        };
        yield {
          type: 'content_delta',
          provider: 'openai',
          model: 'gpt-5-mini',
          delta: 'Hello',
        };
        yield {
          type: 'message_end',
          provider: 'openai',
          model: 'gpt-5-mini',
          outputText: 'Hello',
        };
      });

    const events = await collectEvents(
      service.streamChat({
        userPrompt: 'Hello world',
      }),
    );

    expect(provider.stream).toHaveBeenCalledTimes(2);
    expect(events.some((event) => event.type === 'content_delta')).toBe(true);
  });
});

async function collectEvents(stream: AsyncIterable<AIStreamEvent>): Promise<AIStreamEvent[]> {
  const events: AIStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}
