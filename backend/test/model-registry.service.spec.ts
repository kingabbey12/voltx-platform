import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AIModelDefinition } from '../src/modules/ai/models/ai-model.types';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIProvider, AI_PROVIDERS } from '../src/modules/ai/providers/ai-provider.interface';

describe('ModelRegistryService', () => {
  let service: ModelRegistryService;

  const openAiModels: AIModelDefinition[] = [
    {
      id: 'gpt-5-mini',
      provider: 'openai',
      family: 'gpt-5',
      displayName: 'GPT-5 Mini',
      supportsStreaming: true,
      supportsEmbeddings: false,
    },
  ];

  const googleModels: AIModelDefinition[] = [
    {
      id: 'text-embedding-004',
      provider: 'google',
      family: 'gemini',
      displayName: 'Text Embedding 004',
      supportsStreaming: false,
      supportsEmbeddings: true,
    },
  ];

  beforeEach(async () => {
    const providers: AIProvider[] = [
      {
        name: 'openai',
        chat: jest.fn(),
        stream: jest.fn(),
        embeddings: jest.fn(),
        models: jest.fn().mockResolvedValue(openAiModels),
      },
      {
        name: 'google',
        chat: jest.fn(),
        stream: jest.fn(),
        embeddings: jest.fn(),
        models: jest.fn().mockResolvedValue(googleModels),
      },
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelRegistryService,
        {
          provide: AI_PROVIDERS,
          useValue: providers,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'ai.defaultProvider') {
                return 'openai';
              }

              if (key === 'ai.defaultModel') {
                return 'gpt-5-mini';
              }

              return fallback;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ModelRegistryService);
  });

  it('lists all enabled provider models', async () => {
    const models = await service.listModels();

    expect(models).toHaveLength(2);
    expect(models.map((model) => model.id)).toEqual(['gpt-5-mini', 'text-embedding-004']);
  });

  it('resolves the default chat model', async () => {
    const result = await service.resolveProviderAndModel();

    expect(result.provider.name).toBe('openai');
    expect(result.model.id).toBe('gpt-5-mini');
  });

  it('resolves the requested embeddings model', async () => {
    const result = await service.resolveProviderAndModel(
      'google',
      'text-embedding-004',
      'embeddings',
    );

    expect(result.provider.name).toBe('google');
    expect(result.model.supportsEmbeddings).toBe(true);
  });
});
