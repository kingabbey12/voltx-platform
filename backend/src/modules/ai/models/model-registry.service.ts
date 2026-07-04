import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AI_PROVIDERS } from '../providers/ai-provider.interface';
import { AIModelDefinition, AIProviderName } from './ai-model.types';

@Injectable()
export class ModelRegistryService {
  private cachedModels: AIModelDefinition[] | null = null;

  constructor(
    @Inject(AI_PROVIDERS) private readonly providers: AIProvider[],
    private readonly configService: ConfigService,
  ) {}

  async listModels(forceRefresh = false): Promise<AIModelDefinition[]> {
    if (!forceRefresh && this.cachedModels) {
      return this.cachedModels;
    }

    const providerModels = await Promise.all(this.providers.map((provider) => provider.models()));
    this.cachedModels = providerModels.flat();
    return this.cachedModels;
  }

  async resolveProviderAndModel(
    providerName?: AIProviderName,
    modelId?: string,
    capability: 'chat' | 'embeddings' = 'chat',
  ): Promise<{ provider: AIProvider; model: AIModelDefinition }> {
    const models = await this.listModels();

    if (models.length === 0) {
      throw new ServiceUnavailableException('No AI providers are enabled');
    }

    const candidateModel =
      this.findRequestedModel(models, providerName, modelId) ??
      this.findDefaultModel(models, capability);

    if (!candidateModel) {
      throw new BadRequestException('Requested AI model is unavailable');
    }

    if (capability === 'embeddings' && !candidateModel.supportsEmbeddings) {
      throw new BadRequestException(`Model "${candidateModel.id}" does not support embeddings`);
    }

    const provider = this.providers.find((item) => item.name === candidateModel.provider);
    if (!provider) {
      throw new ServiceUnavailableException(
        `AI provider "${candidateModel.provider}" is not available`,
      );
    }

    return {
      provider,
      model: candidateModel,
    };
  }

  private findRequestedModel(
    models: AIModelDefinition[],
    providerName?: AIProviderName,
    modelId?: string,
  ): AIModelDefinition | undefined {
    if (!providerName && !modelId) {
      return undefined;
    }

    return models.find((model) => {
      if (providerName && model.provider !== providerName) {
        return false;
      }

      if (modelId && model.id !== modelId) {
        return false;
      }

      return true;
    });
  }

  private findDefaultModel(
    models: AIModelDefinition[],
    capability: 'chat' | 'embeddings',
  ): AIModelDefinition | undefined {
    const defaultModelId = this.configService.get<string>('ai.defaultModel', '');
    const defaultProvider = this.configService.get<AIProviderName | undefined>(
      'ai.defaultProvider',
      undefined,
    );

    const preferredModel = models.find((model) => {
      if (defaultProvider && model.provider !== defaultProvider) {
        return false;
      }

      if (defaultModelId && model.id !== defaultModelId) {
        return false;
      }

      return capability === 'chat' ? model.supportsStreaming : model.supportsEmbeddings;
    });

    if (preferredModel) {
      return preferredModel;
    }

    return models.find((model) =>
      capability === 'chat' ? model.supportsStreaming : model.supportsEmbeddings,
    );
  }
}
