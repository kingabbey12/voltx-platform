import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  AIChatResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIModelDefinition,
  AIProviderChatRequest,
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

const OPENAI_MODELS: AIModelDefinition[] = [
  {
    id: 'gpt-5',
    provider: 'openai',
    family: 'gpt-5',
    displayName: 'GPT-5',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    family: 'gpt-5',
    displayName: 'GPT-5 Mini',
    supportsStreaming: true,
    supportsEmbeddings: false,
  },
  {
    id: 'text-embedding-3-large',
    provider: 'openai',
    family: 'gpt-5',
    displayName: 'Text Embedding 3 Large',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
  {
    id: 'text-embedding-3-small',
    provider: 'openai',
    family: 'gpt-5',
    displayName: 'Text Embedding 3 Small',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
];

@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;

  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = configService.get<boolean>('ai.providers.openai.enabled', false);
    this.apiKey = configService.get<string>('ai.providers.openai.apiKey', '');
    this.baseUrl = configService.get<string>(
      'ai.providers.openai.baseUrl',
      'https://api.openai.com/v1',
    );
  }

  /**
   * OpenRouter exposes an OpenAI-compatible chat/completions API at the same
   * shape, so pointing OPENAI_BASE_URL at it is a valid way to run this
   * provider through OpenRouter — but OpenRouter requires provider-prefixed
   * model slugs (e.g. "openai/gpt-4o-mini"), while this provider's own
   * catalog IDs ("gpt-5-mini") are unprefixed and used as stable identifiers
   * everywhere else (seeded agents, DTOs, mobile UI). Translate only the
   * literal string sent over the wire when routed through OpenRouter, so
   * the rest of the system is unaffected either way.
   */
  private wireModel(modelId: string): string {
    if (!this.baseUrl.includes('openrouter.ai')) {
      return modelId;
    }
    const openRouterModels: Record<string, string> = {
      'gpt-5': 'openai/gpt-4o',
      'gpt-5-mini': 'openai/gpt-4o-mini',
      'text-embedding-3-large': 'openai/text-embedding-3-large',
      'text-embedding-3-small': 'openai/text-embedding-3-small',
    };
    return openRouterModels[modelId] ?? modelId;
  }

  async chat(request: AIProviderChatRequest): Promise<AIChatResponse> {
    this.assertConfigured();

    const payload = await fetchJsonObject(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.wireModel(request.model),
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.name ? { name: message.name } : {}),
          })),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxOutputTokens !== undefined
            ? { max_completion_tokens: request.maxOutputTokens }
            : {}),
        }),
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
      usage: usageRecord
        ? {
            inputTokens: getNumber(usageRecord, 'prompt_tokens'),
            outputTokens: getNumber(usageRecord, 'completion_tokens'),
            totalTokens: getNumber(usageRecord, 'total_tokens'),
          }
        : undefined,
    };
  }

  async *stream(request: AIProviderChatRequest): AsyncIterable<AIStreamEvent> {
    this.assertConfigured();

    const messageId = randomUUID();
    let outputText = '';

    yield {
      type: 'message_start',
      provider: this.name,
      model: request.model,
      messageId,
    };

    const stream = await createStreamingResponse(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.wireModel(request.model),
          stream: true,
          // Without this, OpenAI never includes a `usage` field on any
          // streamed chunk — token usage / cost tracking would silently
          // report zero for every real (non-mocked) streaming chat call.
          stream_options: { include_usage: true },
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.name ? { name: message.name } : {}),
          })),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxOutputTokens !== undefined
            ? { max_completion_tokens: request.maxOutputTokens }
            : {}),
        }),
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
      const choiceRecord = getFirstChoiceRecord(payload);
      const deltaRecord = choiceRecord ? getRecord(choiceRecord, 'delta') : undefined;
      const delta = extractTextContent(deltaRecord?.content ?? '');

      if (delta.length > 0) {
        outputText += delta;
        yield {
          type: 'content_delta',
          provider: this.name,
          model: request.model,
          delta,
        };
      }

      finishReason ??= choiceRecord ? getString(choiceRecord, 'finish_reason') : undefined;

      // The usage-bearing chunk (enabled by stream_options above) arrives
      // with an empty `choices` array, typically as the last chunk before
      // [DONE] — after the finish_reason chunk, not instead of it — so
      // this must keep iterating rather than returning as soon as
      // finishReason is seen.
      const usageRecord = getRecord(payload, 'usage');
      if (usageRecord) {
        usage = {
          inputTokens: getNumber(usageRecord, 'prompt_tokens'),
          outputTokens: getNumber(usageRecord, 'completion_tokens'),
          totalTokens: getNumber(usageRecord, 'total_tokens'),
        };
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
      `${this.baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.wireModel(request.model),
          input: request.input,
        }),
        signal: request.signal,
      },
      this.name,
    );

    const data = getArray(payload, 'data') ?? [];
    const vectors = data
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }

        const embedding = item.embedding;
        if (!Array.isArray(embedding)) {
          return null;
        }

        return embedding.filter((value): value is number => typeof value === 'number');
      })
      .filter((vector): vector is number[] => vector !== null);

    return {
      provider: this.name,
      model: request.model,
      vectors,
    };
  }

  models(): Promise<AIModelDefinition[]> {
    if (!this.enabled) {
      return Promise.resolve([]);
    }

    return Promise.resolve(OPENAI_MODELS);
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private assertConfigured(): void {
    if (!this.enabled || this.apiKey.length === 0) {
      throw new AIProviderError(
        friendlyMessageForCategory('invalid_api_key'),
        'provider_not_configured',
        false,
        'invalid_api_key',
        'OpenAI provider is not enabled or configured',
      );
    }
  }
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getFirstChoiceRecord(
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const choices = getArray(payload, 'choices');
  const firstChoice = choices?.[0];
  return isRecord(firstChoice) ? firstChoice : undefined;
}
