import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const XAI_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'grok-2',
    provider: 'xai',
    family: 'grok',
    displayName: 'Grok 2',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'grok-2-mini',
    provider: 'xai',
    family: 'grok',
    displayName: 'Grok 2 Mini',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
];

@Injectable()
export class XaiProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'xai',
      displayName: 'xAI',
      configKey: 'xai',
      defaultBaseUrl: 'https://api.x.ai/v1',
      models: XAI_MODELS,
    });
  }
}
