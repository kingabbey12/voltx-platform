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
  extractTextContent,
  fetchJsonObject,
  getNumber,
  getRecord,
  getString,
  isRecord,
  messageContentToText,
} from './provider-http.utils';

const ANTHROPIC_MODELS: AIModelDefinition[] = [
  {
    id: 'claude-opus-4-1',
    provider: 'anthropic',
    family: 'claude',
    displayName: 'Claude Opus 4.1',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    family: 'claude',
    displayName: 'Claude Sonnet 4.5',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
  {
    id: 'claude-haiku-4',
    provider: 'anthropic',
    family: 'claude',
    displayName: 'Claude Haiku 4',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsVision: true,
  },
];

@Injectable()
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;

  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = configService.get<boolean>('ai.providers.anthropic.enabled', false);
    this.apiKey = configService.get<string>('ai.providers.anthropic.apiKey', '');
    this.baseUrl = configService.get<string>(
      'ai.providers.anthropic.baseUrl',
      'https://api.anthropic.com/v1',
    );
  }

  async chat(request: AIProviderChatRequest): Promise<AIChatResponse> {
    const { apiKey, baseUrl } = this.resolveCredential(request);

    const payload = await fetchJsonObject(
      `${baseUrl}/messages`,
      {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify({
          model: request.model,
          messages: toAnthropicMessages(request.messages),
          system: extractSystemPrompt(request.messages),
          max_tokens: request.maxOutputTokens ?? 1024,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        }),
        signal: request.signal,
      },
      this.name,
    );

    const usageRecord = getRecord(payload, 'usage');

    return {
      id: getString(payload, 'id') ?? randomUUID(),
      provider: this.name,
      model: getString(payload, 'model') ?? request.model,
      outputText: extractTextContent(payload.content),
      finishReason: getString(payload, 'stop_reason') ?? getString(payload, 'type'),
      usage: usageRecord
        ? {
            inputTokens: getNumber(usageRecord, 'input_tokens'),
            outputTokens: getNumber(usageRecord, 'output_tokens'),
            totalTokens: sumNumbers(
              getNumber(usageRecord, 'input_tokens'),
              getNumber(usageRecord, 'output_tokens'),
            ),
          }
        : undefined,
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
      `${baseUrl}/messages`,
      {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify({
          model: request.model,
          messages: toAnthropicMessages(request.messages),
          system: extractSystemPrompt(request.messages),
          max_tokens: request.maxOutputTokens ?? 1024,
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        }),
        signal: request.signal,
      },
      this.name,
    );

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    for await (const event of parseSseStream(stream)) {
      const payload = parseJsonRecord(event.data);
      const delta = getString(getRecord(payload, 'delta') ?? {}, 'text');
      if (delta && delta.length > 0) {
        outputText += delta;
        yield {
          type: 'content_delta',
          provider: this.name,
          model: request.model,
          delta,
        };
      }

      // message_start carries the prompt's input_tokens; each message_delta
      // carries the cumulative output_tokens so far — the last one seen
      // before message_stop is the final count. Without reading these,
      // token usage / cost tracking would silently report zero for every
      // real (non-mocked) streaming chat call.
      if (event.event === 'message_start') {
        const usageRecord = getRecord(getRecord(payload, 'message') ?? {}, 'usage');
        if (usageRecord) {
          inputTokens = getNumber(usageRecord, 'input_tokens');
        }
      }
      if (event.event === 'message_delta') {
        const usageRecord = getRecord(payload, 'usage');
        if (usageRecord) {
          outputTokens = getNumber(usageRecord, 'output_tokens');
        }
      }

      if (event.event === 'message_stop') {
        yield {
          type: 'message_end',
          provider: this.name,
          model: request.model,
          finishReason: getString(payload, 'type'),
          outputText,
          usage: this.toUsage(inputTokens, outputTokens),
        };
        return;
      }
    }

    yield {
      type: 'message_end',
      provider: this.name,
      model: request.model,
      outputText,
      usage: this.toUsage(inputTokens, outputTokens),
    };
  }

  private toUsage(inputTokens?: number, outputTokens?: number): AIUsage | undefined {
    if (inputTokens === undefined && outputTokens === undefined) {
      return undefined;
    }
    const input = inputTokens ?? 0;
    const output = outputTokens ?? 0;
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  embeddings(_request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    return Promise.reject(
      new AIProviderError(
        'Anthropic provider does not support embeddings in this runtime',
        'embeddings_not_supported',
      ),
    );
  }

  models(): Promise<AIModelDefinition[]> {
    if (!this.enabled) {
      return Promise.resolve([]);
    }

    return Promise.resolve(ANTHROPIC_MODELS);
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
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

  private assertConfigured(): void {
    if (!this.enabled || this.apiKey.length === 0) {
      throw new AIProviderError(
        friendlyMessageForCategory('invalid_api_key'),
        'provider_not_configured',
        false,
        'invalid_api_key',
        'Anthropic provider is not enabled or configured',
      );
    }
  }
}

function toAnthropicMessages(messages: AIMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'tool' ? 'assistant' : message.role,
      content: toAnthropicContent(message.content),
    }));
}

/** Anthropic content blocks: `{type:'text',text}` / `{type:'image',source:{type:'base64',media_type,data}}`. Plain strings pass through unchanged — the API accepts either form. */
function toAnthropicContent(
  content: AIMessage['content'],
): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) =>
    part.type === 'image'
      ? {
          type: 'image',
          source: { type: 'base64', media_type: part.mimeType, data: part.base64Data },
        }
      : { type: 'text', text: part.text },
  );
}

function extractSystemPrompt(messages: AIMessage[]): string | undefined {
  const prompts = messages
    .filter((message) => message.role === 'system')
    .map((message) => messageContentToText(message.content).trim())
    .filter((message) => message.length > 0);

  return prompts.length > 0 ? prompts.join('\n\n') : undefined;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sumNumbers(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) {
    return undefined;
  }

  return (a ?? 0) + (b ?? 0);
}
