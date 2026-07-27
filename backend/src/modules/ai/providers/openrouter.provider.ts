import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

/**
 * OpenRouter aggregates many providers behind one OpenAI-compatible API and
 * addresses models by provider-prefixed slug (e.g. "anthropic/claude-3.5-sonnet").
 * The catalog ids here ARE those slugs, so no wire translation is needed —
 * they are used verbatim on the wire and as stable identifiers everywhere.
 */
const OPENROUTER_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'openai/gpt-4o',
    provider: 'openrouter',
    family: 'gpt-5',
    displayName: 'GPT-4o (OpenRouter)',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    provider: 'openrouter',
    family: 'claude',
    displayName: 'Claude 3.5 Sonnet (OpenRouter)',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    provider: 'openrouter',
    family: 'llama',
    displayName: 'Llama 3.1 70B Instruct (OpenRouter)',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
];

@Injectable()
export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'openrouter',
      displayName: 'OpenRouter',
      configKey: 'openrouter',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      models: OPENROUTER_MODELS,
    });
  }
}
