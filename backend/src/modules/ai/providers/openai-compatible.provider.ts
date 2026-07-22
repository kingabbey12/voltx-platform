import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  AIChatResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIMessage,
  AIModelDefinition,
  AIProviderChatRequest,
  AIProviderName,
  AIStreamEvent,
  AIUsage,
} from '../models/ai-model.types';
import { parseSseStream } from '../streaming/sse-parser';
import { AIProvider, AIProviderError } from './ai-provider.interface';
import { friendlyMessageForCategory } from './provider-error-classifier';
import {
  createStreamingResponse,
  extractTextContent,
  fetchJsonObject,
  getArray,
  getNumber,
  getRecord,
  getString,
  isRecord,
} from './provider-http.utils';

/**
 * Configuration for one OpenAI-compatible provider adapter. xAI, Groq,
 * Mistral, DeepSeek, Ollama, and OpenRouter all speak the OpenAI
 * chat/completions + embeddings wire protocol, differing only by base URL,
 * catalog, and (for local Ollama) whether an API key is required. Azure
 * OpenAI is the same protocol with a deployment-scoped URL and an `api-key`
 * header — see AzureOpenAIProvider, which overrides only those two hooks.
 */
export interface OpenAICompatibleProviderOptions {
  readonly name: AIProviderName;
  /** Config namespace under `ai.providers.<configKey>` (enabled/apiKey/baseUrl). */
  readonly configKey: string;
  readonly defaultBaseUrl: string;
  readonly models: readonly AIModelDefinition[];
  /** Local providers (Ollama) serve without an API key. */
  readonly requiresApiKey?: boolean;
  /** Human name used in the "not configured" error. */
  readonly displayName: string;
}

/**
 * Shared OpenAI-compatible provider. Reuses the same HTTP/SSE helpers
 * (`provider-http.utils`) as the first-party OpenAIProvider, so every
 * adapter parses responses and token usage identically. Subclasses supply
 * only their catalog and endpoints; behaviour (streaming usage accounting,
 * multimodal content mapping, error classification) is uniform.
 */
export abstract class OpenAICompatibleProvider implements AIProvider {
  readonly name: AIProviderName;

  protected readonly enabled: boolean;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly displayName: string;
  private readonly requiresApiKey: boolean;
  private readonly modelCatalog: readonly AIModelDefinition[];

  protected constructor(configService: ConfigService, options: OpenAICompatibleProviderOptions) {
    this.name = options.name;
    this.displayName = options.displayName;
    this.requiresApiKey = options.requiresApiKey ?? true;
    this.modelCatalog = options.models;
    this.enabled = configService.get<boolean>(`ai.providers.${options.configKey}.enabled`, false);
    this.apiKey = configService.get<string>(`ai.providers.${options.configKey}.apiKey`, '');
    this.baseUrl = configService.get<string>(
      `ai.providers.${options.configKey}.baseUrl`,
      options.defaultBaseUrl,
    );
  }

  async chat(request: AIProviderChatRequest): Promise<AIChatResponse> {
    this.assertConfigured();

    const payload = await fetchJsonObject(
      this.chatCompletionsUrl(request.model),
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildChatBody(request, false)),
        signal: request.signal,
      },
      this.name,
    );

    const choices = getArray(payload, 'choices');
    const firstChoice = choices?.[0];
    const choiceRecord = isRecord(firstChoice) ? firstChoice : undefined;
    const messageRecord = choiceRecord ? getRecord(choiceRecord, 'message') : undefined;
    const usageRecord = getRecord(payload, 'usage');

    return {
      id: getString(payload, 'id') ?? randomUUID(),
      provider: this.name,
      model: getString(payload, 'model') ?? request.model,
      outputText: extractTextContent(messageRecord?.content ?? ''),
      finishReason: choiceRecord ? getString(choiceRecord, 'finish_reason') : undefined,
      usage: usageRecord ? toUsage(usageRecord) : undefined,
    };
  }

  async *stream(request: AIProviderChatRequest): AsyncIterable<AIStreamEvent> {
    this.assertConfigured();

    const messageId = randomUUID();
    let outputText = '';

    yield { type: 'message_start', provider: this.name, model: request.model, messageId };

    const stream = await createStreamingResponse(
      this.chatCompletionsUrl(request.model),
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildChatBody(request, true)),
        signal: request.signal,
      },
      this.name,
    );

    let finishReason: string | undefined;
    let usage: AIUsage | undefined;

    for await (const event of parseSseStream(stream)) {
      if (event.data === '[DONE]') {
        break;
      }

      const payload = parseJsonRecord(event.data);
      const choices = getArray(payload, 'choices');
      const firstChoice = choices?.[0];
      const choiceRecord = isRecord(firstChoice) ? firstChoice : undefined;
      const deltaRecord = choiceRecord ? getRecord(choiceRecord, 'delta') : undefined;
      const delta = extractTextContent(deltaRecord?.content ?? '');

      if (delta.length > 0) {
        outputText += delta;
        yield { type: 'content_delta', provider: this.name, model: request.model, delta };
      }

      finishReason ??= choiceRecord ? getString(choiceRecord, 'finish_reason') : undefined;

      const usageRecord = getRecord(payload, 'usage');
      if (usageRecord) {
        usage = toUsage(usageRecord);
      }
    }

    yield {
      type: 'message_end',
      provider: this.name,
      model: request.model,
      finishReason,
      outputText,
      usage,
    };
  }

  async embeddings(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    this.assertConfigured();

    const payload = await fetchJsonObject(
      this.embeddingsUrl(request.model),
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ model: this.wireModel(request.model), input: request.input }),
        signal: request.signal,
      },
      this.name,
    );

    const data = getArray(payload, 'data') ?? [];
    const vectors = data
      .map((item) => {
        if (!isRecord(item) || !Array.isArray(item.embedding)) {
          return null;
        }
        return item.embedding.filter((value): value is number => typeof value === 'number');
      })
      .filter((vector): vector is number[] => vector !== null);

    return { provider: this.name, model: request.model, vectors };
  }

  models(): Promise<AIModelDefinition[]> {
    return Promise.resolve(this.enabled ? [...this.modelCatalog] : []);
  }

  // ————— Overridable hooks (Azure overrides URL + headers) —————

  protected chatCompletionsUrl(_model: string): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected embeddingsUrl(_model: string): string {
    return `${this.baseUrl}/embeddings`;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** OpenRouter overrides this to translate catalog ids into its slug scheme. */
  protected wireModel(model: string): string {
    return model;
  }

  protected buildChatBody(
    request: AIProviderChatRequest,
    stream: boolean,
  ): Record<string, unknown> {
    return {
      model: this.wireModel(request.model),
      messages: toOpenAIMessages(request.messages),
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxOutputTokens !== undefined
        ? { max_completion_tokens: request.maxOutputTokens }
        : {}),
    };
  }

  protected assertConfigured(): void {
    const missingKey = this.requiresApiKey && this.apiKey.length === 0;
    if (!this.enabled || missingKey) {
      throw new AIProviderError(
        friendlyMessageForCategory('invalid_api_key'),
        'provider_not_configured',
        false,
        'invalid_api_key',
        `${this.displayName} provider is not enabled or configured`,
      );
    }
  }
}

function toUsage(usageRecord: Record<string, unknown>): AIUsage {
  return {
    inputTokens: getNumber(usageRecord, 'prompt_tokens'),
    outputTokens: getNumber(usageRecord, 'completion_tokens'),
    totalTokens: getNumber(usageRecord, 'total_tokens'),
  };
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toOpenAIMessages(messages: AIMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role,
    content: toOpenAIContent(message.content),
    ...(message.name ? { name: message.name } : {}),
  }));
}

function toOpenAIContent(content: AIMessage['content']): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) =>
    part.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.base64Data}` } }
      : { type: 'text', text: part.text },
  );
}
