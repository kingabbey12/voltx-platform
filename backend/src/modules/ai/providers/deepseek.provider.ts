import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const DEEPSEEK_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    family: 'deepseek',
    displayName: 'DeepSeek Chat',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    family: 'deepseek',
    displayName: 'DeepSeek Reasoner',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
];

@Injectable()
export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(configService: ConfigService) {
    super(configService, {
      name: 'deepseek',
      displayName: 'DeepSeek',
      configKey: 'deepseek',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      models: DEEPSEEK_MODELS,
    });
  }
}
