import { Logger } from '@nestjs/common';
import { AIProviderError } from './ai-provider.interface';
import { classifyProviderError, extractProviderRequestId } from './provider-error-classifier';

const logger = new Logger('AIProviderHttp');

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

export function getArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = record[key];
  return Array.isArray(value) ? value : undefined;
}

export function getRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

export function extractTextContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (!isRecord(item)) {
        return '';
      }

      return getString(item, 'text') ?? '';
    })
    .join('');
}

export async function fetchJsonObject(
  url: string,
  init: RequestInit,
  providerName: string,
): Promise<Record<string, unknown>> {
  const response = await fetchOrThrowClassified(url, init, providerName);
  const body = await readJsonBody(response);

  if (!response.ok) {
    throw buildClassifiedError(providerName, response, body);
  }

  if (!isRecord(body)) {
    throw new AIProviderError('Provider returned an invalid JSON payload', 'provider_invalid_json');
  }

  return body;
}

export async function createStreamingResponse(
  url: string,
  init: RequestInit,
  providerName: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetchOrThrowClassified(url, init, providerName);

  if (!response.ok) {
    const body = await readJsonBody(response);
    throw buildClassifiedError(providerName, response, body);
  }

  if (!response.body) {
    throw new AIProviderError('Provider did not return a stream body', 'provider_missing_stream');
  }

  return response.body;
}

/** Distinguishes a timed-out/aborted/network-level failure (no HTTP response at all) from a normal non-ok HTTP response, since the two need different classification and neither should leak raw fetch/DOM error text to the client. */
async function fetchOrThrowClassified(
  url: string,
  init: RequestInit,
  providerName: string,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const rawMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { provider: providerName, url, isTimeout: isAbort, rawMessage },
      `AI provider request failed before a response was received (${providerName})`,
    );
    const classified = classifyProviderError(undefined, rawMessage, isAbort);
    throw new AIProviderError(
      classified.userMessage,
      'provider_request_failed',
      classified.retryable,
      classified.category,
      rawMessage,
    );
  }
}

function buildClassifiedError(
  providerName: string,
  response: Response,
  body: unknown,
): AIProviderError {
  const rawMessage =
    extractProviderErrorMessage(body) ?? `Provider request failed with status ${response.status}`;
  const requestId = extractProviderRequestId(response, body);
  const classified = classifyProviderError(response.status, rawMessage);

  logger.error(
    {
      provider: providerName,
      status: response.status,
      requestId,
      category: classified.category,
      rawMessage,
    },
    `AI provider returned an error (${providerName})`,
  );

  return new AIProviderError(
    classified.userMessage,
    'provider_request_failed',
    classified.retryable,
    classified.category,
    rawMessage,
  );
}

function extractProviderErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const errorRecord = getRecord(payload, 'error');
  if (errorRecord) {
    return (
      getString(errorRecord, 'message') ??
      getString(errorRecord, 'detail') ??
      getString(errorRecord, 'error')
    );
  }

  return getString(payload, 'message');
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}
