import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const MISTRAL_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'mistral-large-latest',
    provider: 'mistral',
    family: 'mistral',
    displayName: 'Mistral Large',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'mistral-small-latest',
    provider: 'mistral',
    family: 'mistral',
    displayName: 'Mistral Small',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'mistral-embed',
    provider: 'mistral',
    family: 'mistral',
    displayName: 'Mistral Embed',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
];

@Injectable()
export class MistralProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'mistral',
      displayName: 'Mistral',
      configKey: 'mistral',
      defaultBaseUrl: 'https://api.mistral.ai/v1',
      models: MISTRAL_MODELS,
    });
  }
}
