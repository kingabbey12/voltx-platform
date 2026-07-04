import { AIProviderError } from './ai-provider.interface';

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
): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new AIProviderError(
      extractProviderErrorMessage(body) ?? `Provider request failed with status ${response.status}`,
      'provider_request_failed',
      response.status >= 500 || response.status === 429,
    );
  }

  if (!isRecord(body)) {
    throw new AIProviderError('Provider returned an invalid JSON payload', 'provider_invalid_json');
  }

  return body;
}

export async function createStreamingResponse(
  url: string,
  init: RequestInit,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await readJsonBody(response);
    throw new AIProviderError(
      extractProviderErrorMessage(body) ?? `Provider request failed with status ${response.status}`,
      'provider_request_failed',
      response.status >= 500 || response.status === 429,
    );
  }

  if (!response.body) {
    throw new AIProviderError('Provider did not return a stream body', 'provider_missing_stream');
  }

  return response.body;
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
