import { AiCredentialTester } from '../src/modules/ai/credentials/ai-credential-tester.service';
import { AIProvider, AIProviderError } from '../src/modules/ai/providers/ai-provider.interface';
import { AIProviderChatRequest } from '../src/modules/ai/models/ai-model.types';

function fakeProvider(
  name: string,
  chatImpl: (request: AIProviderChatRequest) => Promise<unknown>,
): AIProvider {
  return {
    name: name as AIProvider['name'],
    chat: chatImpl as AIProvider['chat'],
    stream: () => {
      throw new Error('not used');
    },
    embeddings: () => {
      throw new Error('not used');
    },
    models: () => Promise.resolve([]),
  };
}

describe('AiCredentialTester', () => {
  it('passes the tenant key through credentialOverride and reports ok on success', async () => {
    let seen: AIProviderChatRequest | undefined;
    const provider = fakeProvider('openai', (request) => {
      seen = request;
      return Promise.resolve({ outputText: 'pong' });
    });
    const tester = new AiCredentialTester([provider]);

    const result = await tester.test('openai', 'sk-tenant-key', 'https://custom.example/v1');

    expect(result.ok).toBe(true);
    expect(seen?.credentialOverride).toEqual({
      apiKey: 'sk-tenant-key',
      baseUrl: 'https://custom.example/v1',
    });
    expect(seen?.maxOutputTokens).toBe(1);
  });

  it('reports a classified failure when the provider rejects the key', async () => {
    const provider = fakeProvider('openai', () =>
      Promise.reject(
        new AIProviderError('Invalid API key', 'provider_not_configured', false, 'invalid_api_key'),
      ),
    );
    const tester = new AiCredentialTester([provider]);

    const result = await tester.test('openai', 'bad-key');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('invalid_api_key: Invalid API key');
  });

  it('fails cleanly when no adapter is registered for the provider', async () => {
    const tester = new AiCredentialTester([]);
    const result = await tester.test('mistral', 'key');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('mistral');
  });
});
