import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const GROQ_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    family: 'llama',
    displayName: 'Llama 3.3 70B (Groq)',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    family: 'llama',
    displayName: 'Llama 3.1 8B Instant (Groq)',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
];

@Injectable()
export class GroqProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'groq',
      displayName: 'Groq',
      configKey: 'groq',
      defaultBaseUrl: 'https://api.groq.com/openai/v1',
      models: GROQ_MODELS,
    });
  }
}
