import {
  AIChatResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIModelDefinition,
  AIProviderChatRequest,
  AIProviderName,
  AIStreamEvent,
} from '../models/ai-model.types';

export interface AIProvider {
  readonly name: AIProviderName;

  chat(request: AIProviderChatRequest): Promise<AIChatResponse>;
  stream(request: AIProviderChatRequest): AsyncIterable<AIStreamEvent>;
  embeddings(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;
  models(): Promise<AIModelDefinition[]>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
