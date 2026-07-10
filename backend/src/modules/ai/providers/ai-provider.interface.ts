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

export type AIProviderErrorCategory =
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'context_length_exceeded'
  | 'provider_unavailable'
  | 'timeout'
  | 'unknown';

export class AIProviderError extends Error {
  constructor(
    /** User-facing text — this is what reaches the frontend, so it must never contain raw provider output. */
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly category: AIProviderErrorCategory = 'unknown',
    /** The original, unmodified provider error text — logged for debugging, never returned in an API response. */
    public readonly providerDetail?: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
