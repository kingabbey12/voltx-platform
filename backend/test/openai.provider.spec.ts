import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from '../src/modules/ai/providers/openai.provider';

const REQUEST = {
  model: 'gpt-5-mini',
  messages: [{ role: 'user' as const, content: 'Qualify this lead.' }],
  temperature: 0.4,
  maxOutputTokens: 512,
};

function responseBody(): Response {
  return new Response(
    JSON.stringify({
      id: 'response-1',
      model: 'gpt-5-mini',
      choices: [{ message: { content: 'Qualified.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function parseRequestBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected the provider request body to be JSON text');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('OpenAIProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('omits unsupported temperature for direct GPT-5 requests', async () => {
    const provider = new OpenAIProvider(
      new ConfigService({
        ai: {
          providers: {
            openai: {
              enabled: true,
              apiKey: 'test-key',
              baseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }),
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(responseBody());

    await provider.chat(REQUEST);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = parseRequestBody(init);
    expect(body).toMatchObject({ model: 'gpt-5-mini', max_completion_tokens: 512 });
    expect(body).not.toHaveProperty('temperature');
  });

  it('uses an override base URL for OpenRouter model mapping', async () => {
    const provider = new OpenAIProvider(
      new ConfigService({
        ai: {
          providers: {
            openai: {
              enabled: true,
              apiKey: 'platform-key',
              baseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }),
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(responseBody());

    await provider.chat({
      ...REQUEST,
      credentialOverride: {
        apiKey: 'tenant-key',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const init = fetchMock.mock.calls[0]?.[1];
    const body = parseRequestBody(init);
    expect(body).toMatchObject({ model: 'openai/gpt-4o-mini', temperature: 0.4 });
  });
});
