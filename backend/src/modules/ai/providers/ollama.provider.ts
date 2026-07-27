import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const OLLAMA_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'llama3.1',
    provider: 'ollama',
    family: 'llama',
    displayName: 'Llama 3.1 (Ollama)',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'qwen2.5',
    provider: 'ollama',
    family: 'qwen',
    displayName: 'Qwen 2.5 (Ollama)',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'nomic-embed-text',
    provider: 'ollama',
    family: 'llama',
    displayName: 'Nomic Embed Text (Ollama)',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
];

/**
 * Ollama runs locally and exposes an OpenAI-compatible API at /v1 with no
 * API key, so `requiresApiKey` is false — enabling the provider is enough.
 */
@Injectable()
export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'ollama',
      displayName: 'Ollama',
      configKey: 'ollama',
      defaultBaseUrl: 'http://localhost:11434/v1',
      models: OLLAMA_MODELS,
      requiresApiKey: false,
    });
  }
}
