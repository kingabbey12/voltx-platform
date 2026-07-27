import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  AIChatResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIMessage,
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
  fetchJsonObject,
  getArray,
  getNumber,
  getRecord,
  getString,
  isRecord,
  messageContentToText,
} from './provider-http.utils';

const GOOGLE_MODELS: AIModelDefinition[] = [
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    family: 'gemini',
    displayName: 'Gemini 2.5 Pro',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    family: 'gemini',
    displayName: 'Gemini 2.5 Flash',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'text-embedding-004',
    provider: 'google',
    family: 'gemini',
    displayName: 'Text Embedding 004',
    supportsStreaming: false,
    supportsEmbeddings: true,
  },
];

@Injectable()
export class GoogleAIProvider implements AIProvider {
  readonly name = 'google' as const;

  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = configService.get<boolean>('ai.providers.google.enabled', false);
    this.apiKey = configService.get<string>('ai.providers.google.apiKey', '');
    this.baseUrl = configService.get<string>(
      'ai.providers.google.baseUrl',
      'https://generativelanguage.googleapis.com/v1beta',
    );
  }

  async chat(request: AIProviderChatRequest): Promise<AIChatResponse> {
    const { apiKey, baseUrl } = this.resolveCredential(request);

    const payload = await fetchJsonObject(
      this.buildModelUrl(request.model, 'generateContent', apiKey, baseUrl),
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildChatBody(request)),
        signal: request.signal,
      },
      this.name,
    );

    return {
      id: randomUUID(),
      provider: this.name,
      model: request.model,
      outputText: extractGeminiText(payload),
      finishReason: extractGeminiFinishReason(payload),
      usage: extractGeminiUsage(payload),
    };
  }

  async *stream(request: AIProviderChatRequest): AsyncIterable<AIStreamEvent> {
    const { apiKey, baseUrl } = this.resolveCredential(request);

    const messageId = randomUUID();
    let outputText = '';

    yield {
      type: 'message_start',
      provider: this.name,
      model: request.model,
      messageId,
    };

    const stream = await createStreamingResponse(
      `${this.buildModelUrl(request.model, 'streamGenerateContent', apiKey, baseUrl)}&alt=sse`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildChatBody(request)),
        signal: request.signal,
      },
      this.name,
    );

    let finishReason: string | undefined;
    let usage: AIUsage | undefined;

    for await (const event of parseSseStream(stream)) {
      const payload = parseJsonRecord(event.data);
      const delta = extractGeminiText(payload);

      if (delta.length > 0) {
        outputText += delta;
        yield {
          type: 'content_delta',
          provider: this.name,
          model: request.model,
          delta,
        };
      }

      finishReason ??= extractGeminiFinishReason(payload);
      // usageMetadata is cumulative per chunk, so the last chunk's value
      // (not the first finishReason-bearing one) is the final count.
      usage = extractGeminiUsage(payload) ?? usage;
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
    const { apiKey, baseUrl } = this.resolveCredential(request);

    const vectors: number[][] = [];

    for (const input of request.input) {
      const payload = await fetchJsonObject(
        this.buildModelUrl(request.model, 'embedContent', apiKey, baseUrl),
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            content: {
              parts: [{ text: input }],
            },
          }),
          signal: request.signal,
        },
        this.name,
      );

      const embeddingRecord = getRecord(payload, 'embedding');
      const values = embeddingRecord?.values;
      if (Array.isArray(values)) {
        vectors.push(values.filter((value): value is number => typeof value === 'number'));
      }
    }

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

    return Promise.resolve(GOOGLE_MODELS);
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Effective credential for one call: a tenant's per-request override (from
   * the Tenant AI Credentials module) supersedes the env-configured key. The
   * configured-provider guard runs only without an override.
   */
  private resolveCredential(request: AIProviderChatRequest | AIEmbeddingRequest): {
    apiKey: string;
    baseUrl: string;
  } {
    const override = request.credentialOverride;
    if (override) {
      return { apiKey: override.apiKey, baseUrl: override.baseUrl ?? this.baseUrl };
    }
    this.assertConfigured();
    return { apiKey: this.apiKey, baseUrl: this.baseUrl };
  }

  private buildModelUrl(model: string, action: string, apiKey: string, baseUrl: string): string {
    return `${baseUrl}/models/${model}:${action}?key=${encodeURIComponent(apiKey)}`;
  }

  private buildChatBody(request: AIProviderChatRequest): Record<string, unknown> {
    return {
      contents: toGeminiContents(request.messages),
      ...(extractSystemInstruction(request.messages)
        ? {
            system_instruction: {
              parts: [{ text: extractSystemInstruction(request.messages) }],
            },
          }
        : {}),
      generationConfig: {
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxOutputTokens !== undefined
          ? { maxOutputTokens: request.maxOutputTokens }
          : {}),
      },
    };
  }

  private assertConfigured(): void {
    if (!this.enabled || this.apiKey.length === 0) {
      throw new AIProviderError(
        friendlyMessageForCategory('invalid_api_key'),
        'provider_not_configured',
        false,
        'invalid_api_key',
        'Google AI provider is not enabled or configured',
      );
    }
  }
}

function toGeminiContents(messages: AIMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(message.content),
    }));
}

/** Gemini content parts: `{text}` / `{inlineData:{mimeType,data}}`. */
function toGeminiParts(content: AIMessage['content']): Array<Record<string, unknown>> {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  return content.map((part) =>
    part.type === 'image'
      ? { inlineData: { mimeType: part.mimeType, data: part.base64Data } }
      : { text: part.text },
  );
}

function extractSystemInstruction(messages: AIMessage[]): string | undefined {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => messageContentToText(message.content).trim())
    .filter((message) => message.length > 0);

  return systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined;
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = getArray(payload, 'candidates');
  const firstCandidate = candidates?.[0];
  if (!isRecord(firstCandidate)) {
    return '';
  }

  const content = getRecord(firstCandidate, 'content');
  const parts = content ? getArray(content, 'parts') : undefined;

  return (parts ?? [])
    .map((part) => (isRecord(part) ? (getString(part, 'text') ?? '') : ''))
    .join('');
}

function extractGeminiFinishReason(payload: Record<string, unknown>): string | undefined {
  const candidates = getArray(payload, 'candidates');
  const firstCandidate = candidates?.[0];
  return isRecord(firstCandidate) ? getString(firstCandidate, 'finishReason') : undefined;
}

// Gemini includes `usageMetadata` on every response (streamed chunks carry
// the running total, so the last chunk seen is authoritative) — without
// reading it, token usage / cost tracking would silently report zero for
// every real (non-mocked) Google chat call, streaming or not.
function extractGeminiUsage(payload: Record<string, unknown>): AIUsage | undefined {
  const usageMetadata = getRecord(payload, 'usageMetadata');
  if (!usageMetadata) {
    return undefined;
  }
  return {
    inputTokens: getNumber(usageMetadata, 'promptTokenCount'),
    outputTokens: getNumber(usageMetadata, 'candidatesTokenCount'),
    totalTokens: getNumber(usageMetadata, 'totalTokenCount'),
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
