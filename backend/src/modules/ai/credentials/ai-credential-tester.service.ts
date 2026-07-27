import { Inject, Injectable } from '@nestjs/common';
import { AIProviderName } from '../models/ai-model.types';
import { AI_PROVIDERS, AIProvider, AIProviderError } from '../providers/ai-provider.interface';

export interface CredentialTestResult {
  ok: boolean;
  message: string;
}

/**
 * A cheap, single-token chat probe per provider used for the health check. It
 * exercises the real provider adapter (the gateway) with the tenant's key via
 * `credentialOverride`, so a passing test means the same code path a live
 * request uses actually authenticated. Independent of the provider's env
 * `enabled` flag — a BYO key is valid even when the platform default is off.
 */
const PROVIDER_TEST_MODELS: Record<AIProviderName, string> = {
  openai: 'gpt-5-mini',
  anthropic: 'claude-haiku-4',
  google: 'gemini-2.5-flash',
  xai: 'grok-2-mini',
  groq: 'llama-3.1-8b-instant',
  mistral: 'mistral-small-latest',
  deepseek: 'deepseek-chat',
  ollama: 'llama3.1',
  openrouter: 'openai/gpt-4o',
  'azure-openai': 'gpt-5',
};

@Injectable()
export class AiCredentialTester {
  constructor(@Inject(AI_PROVIDERS) private readonly providers: AIProvider[]) {}

  async test(
    provider: AIProviderName,
    apiKey: string,
    baseUrl?: string,
  ): Promise<CredentialTestResult> {
    const impl = this.providers.find((candidate) => candidate.name === provider);
    if (!impl) {
      return { ok: false, message: `No adapter is registered for provider "${provider}"` };
    }

    try {
      await impl.chat({
        model: PROVIDER_TEST_MODELS[provider],
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 1,
        credentialOverride: { apiKey, baseUrl },
      });
      return { ok: true, message: 'Provider authenticated and responded.' };
    } catch (error) {
      if (error instanceof AIProviderError) {
        return { ok: false, message: `${error.category}: ${error.message}` };
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Provider test failed.',
      };
    }
  }
}
