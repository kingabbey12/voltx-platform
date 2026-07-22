import { ConfigService } from '@nestjs/config';
import { AIProviderError } from '../src/modules/ai/providers/ai-provider.interface';
import { OpenAICompatibleProvider } from '../src/modules/ai/providers/openai-compatible.provider';
import { XaiProvider } from '../src/modules/ai/providers/xai.provider';
import { GroqProvider } from '../src/modules/ai/providers/groq.provider';
import { MistralProvider } from '../src/modules/ai/providers/mistral.provider';
import { DeepSeekProvider } from '../src/modules/ai/providers/deepseek.provider';
import { OllamaProvider } from '../src/modules/ai/providers/ollama.provider';
import { OpenRouterProvider } from '../src/modules/ai/providers/openrouter.provider';
import { AzureOpenAIProvider } from '../src/modules/ai/providers/azure-openai.provider';
import { AIProviderChatRequest } from '../src/modules/ai/models/ai-model.types';

type Ctor = new (configService: ConfigService) => OpenAICompatibleProvider;

/** ConfigService stub: returns overrides by key, else the caller's default. */
function stubConfig(overrides: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, def?: unknown) => (key in overrides ? overrides[key] : def),
  } as unknown as ConfigService;
}

function enabled(configKey: string, extra: Record<string, unknown> = {}): ConfigService {
  return stubConfig({
    [`ai.providers.${configKey}.enabled`]: true,
    [`ai.providers.${configKey}.apiKey`]: 'test-key',
    ...extra,
  });
}

function okChatResponse(model: string): Response {
  return new Response(
    JSON.stringify({
      id: 'cmpl-1',
      model,
      choices: [{ message: { content: 'hello world' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const CHAT: AIProviderChatRequest = {
  model: '',
  messages: [{ role: 'user', content: 'hi' }],
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('OpenAI-compatible provider adapters', () => {
  const cases: Array<{
    name: string;
    Provider: Ctor;
    configKey: string;
    providerName: string;
    expectedBaseUrl: string;
    sampleModel: string;
  }> = [
    {
      name: 'xAI',
      Provider: XaiProvider,
      configKey: 'xai',
      providerName: 'xai',
      expectedBaseUrl: 'https://api.x.ai/v1',
      sampleModel: 'grok-2',
    },
    {
      name: 'Groq',
      Provider: GroqProvider,
      configKey: 'groq',
      providerName: 'groq',
      expectedBaseUrl: 'https://api.groq.com/openai/v1',
      sampleModel: 'llama-3.1-8b-instant',
    },
    {
      name: 'Mistral',
      Provider: MistralProvider,
      configKey: 'mistral',
      providerName: 'mistral',
      expectedBaseUrl: 'https://api.mistral.ai/v1',
      sampleModel: 'mistral-large-latest',
    },
    {
      name: 'DeepSeek',
      Provider: DeepSeekProvider,
      configKey: 'deepseek',
      providerName: 'deepseek',
      expectedBaseUrl: 'https://api.deepseek.com/v1',
      sampleModel: 'deepseek-chat',
    },
    {
      name: 'OpenRouter',
      Provider: OpenRouterProvider,
      configKey: 'openrouter',
      providerName: 'openrouter',
      expectedBaseUrl: 'https://openrouter.ai/api/v1',
      sampleModel: 'openai/gpt-4o',
    },
  ];

  describe.each(cases)(
    '$name',
    ({ Provider, configKey, providerName, expectedBaseUrl, sampleModel }) => {
      it('posts an OpenAI-shaped chat request to the provider base URL with bearer auth', async () => {
        const fetchMock = jest.fn().mockResolvedValue(okChatResponse(sampleModel));
        global.fetch = fetchMock;

        const provider = new Provider(enabled(configKey));
        const result = await provider.chat({ ...CHAT, model: sampleModel });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${expectedBaseUrl}/chat/completions`);
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer test-key');
        const body = JSON.parse(init.body as string) as { model: string; messages: unknown[] };
        expect(body.model).toBe(sampleModel);
        expect(body.messages).toHaveLength(1);

        expect(result.provider).toBe(providerName);
        expect(result.outputText).toBe('hello world');
        expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
      });

      it('exposes its model catalog only when enabled', async () => {
        const disabled = await new Provider(stubConfig({})).models();
        expect(disabled).toEqual([]);

        const models = await new Provider(enabled(configKey)).models();
        expect(models.length).toBeGreaterThan(0);
        expect(models.every((m) => m.provider === providerName)).toBe(true);
      });

      it('fails closed with AIProviderError when not configured', async () => {
        const provider = new Provider(stubConfig({}));
        await expect(provider.chat({ ...CHAT, model: sampleModel })).rejects.toBeInstanceOf(
          AIProviderError,
        );
      });
    },
  );

  describe('Ollama (local, no API key)', () => {
    it('works when enabled without any API key', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okChatResponse('llama3.1'));
      global.fetch = fetchMock;

      const provider = new OllamaProvider(
        stubConfig({ 'ai.providers.ollama.enabled': true }), // no apiKey
      );
      const result = await provider.chat({ ...CHAT, model: 'llama3.1' });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('http://localhost:11434/v1/chat/completions');
      expect(result.provider).toBe('ollama');
    });

    it('still fails closed when disabled', async () => {
      const provider = new OllamaProvider(stubConfig({}));
      await expect(provider.chat({ ...CHAT, model: 'llama3.1' })).rejects.toBeInstanceOf(
        AIProviderError,
      );
    });
  });

  describe('Azure OpenAI (deployment URL + api-key header)', () => {
    it('routes to the deployment-scoped URL with the api-key header', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okChatResponse('gpt-5'));
      global.fetch = fetchMock;

      const provider = new AzureOpenAIProvider(
        enabled('azureOpenai', {
          'ai.providers.azureOpenai.baseUrl': 'https://my-resource.openai.azure.com',
          'ai.providers.azureOpenai.apiVersion': '2024-10-21',
        }),
      );
      const result = await provider.chat({ ...CHAT, model: 'gpt-5' });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://my-resource.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2024-10-21',
      );
      const headers = init.headers as Record<string, string>;
      expect(headers['api-key']).toBe('test-key');
      expect(headers.Authorization).toBeUndefined();
      expect(result.provider).toBe('azure-openai');
    });
  });
});
