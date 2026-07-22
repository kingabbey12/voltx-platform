import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModelDefinition } from '../models/ai-model.types';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

const AZURE_MODELS: readonly AIModelDefinition[] = [
  {
    id: 'gpt-5',
    provider: 'azure-openai',
    family: 'gpt-5',
    displayName: 'GPT-5 (Azure)',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'text-embedding-3-large',
    provider: 'azure-openai',
    family: 'gpt-5',
    displayName: 'Text Embedding 3 Large (Azure)',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
];

/**
 * Azure OpenAI speaks the same wire protocol as OpenAI but addresses models
 * through deployment-scoped URLs
 * (`{endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...`)
 * and authenticates with an `api-key` header instead of a bearer token. The
 * model id is used as the deployment name — the conventional Azure setup
 * where a deployment is named after the model it serves. Only the URL and
 * header hooks are overridden; streaming, usage accounting, and content
 * mapping are inherited unchanged.
 */
@Injectable()
export class AzureOpenAIProvider extends OpenAICompatibleProvider {
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    super(configService, {
      name: 'azure-openai',
      displayName: 'Azure OpenAI',
      configKey: 'azureOpenai',
      // Azure has no global default endpoint — each resource is distinct.
      defaultBaseUrl: '',
      models: AZURE_MODELS,
    });
    this.apiVersion = configService.get<string>(
      'ai.providers.azureOpenai.apiVersion',
      '2024-10-21',
    );
  }

  protected override chatCompletionsUrl(model: string): string {
    return this.deploymentUrl(model, 'chat/completions');
  }

  protected override embeddingsUrl(model: string): string {
    return this.deploymentUrl(model, 'embeddings');
  }

  protected override buildHeaders(): Record<string, string> {
    return { 'api-key': this.apiKey, 'Content-Type': 'application/json' };
  }

  private deploymentUrl(model: string, path: string): string {
    const endpoint = this.baseUrl.replace(/\/$/, '');
    return `${endpoint}/openai/deployments/${encodeURIComponent(model)}/${path}?api-version=${this.apiVersion}`;
  }
}
