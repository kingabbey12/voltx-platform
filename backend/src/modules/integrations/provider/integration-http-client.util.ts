import { IntegrationProviderError, IntegrationRateLimitInfo } from './integration-provider.types';

export interface IntegrationHttpRequestOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}

export interface IntegrationHttpResult<T> {
  status: number;
  body: T;
  rateLimit: IntegrationRateLimitInfo;
  attempts: number;
  durationMs: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;

/**
 * Shared fetch wrapper every connector uses for its outbound HTTP calls —
 * retry-with-backoff on 429/5xx (honoring Retry-After when present),
 * rate-limit header extraction, and JSON body parsing. This is the one
 * implementation of "Rate Limits / Retry Logic / Error Recovery" the
 * ticket asks for; individual connectors never hand-roll their own retry
 * loop.
 */
export async function requestJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  options: IntegrationHttpRequestOptions = {},
): Promise<IntegrationHttpResult<T>> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const startedAt = Date.now();

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    attempt += 1;
    try {
      const response = await fetch(url, { ...init, signal: options.signal });
      const rateLimit = parseRateLimitHeaders(response.headers);

      if ((response.status === 429 || response.status >= 500) && attempt <= maxRetries) {
        const retryAfterMs = parseRetryAfterMs(response.headers);
        await delay(retryAfterMs ?? baseDelayMs * 2 ** (attempt - 1), options.signal);
        continue;
      }

      const body = await parseBody<T>(response);

      if (!response.ok) {
        throw new IntegrationProviderError(
          `Request to ${url} failed with status ${response.status}`,
          `http_${response.status}`,
          response.status === 429 || response.status >= 500,
          rateLimit,
        );
      }

      return {
        status: response.status,
        body,
        rateLimit,
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof IntegrationProviderError && !error.retryable) {
        throw error;
      }
      if (isAbortError(error) || attempt > maxRetries) {
        break;
      }
      await delay(baseDelayMs * 2 ** (attempt - 1), options.signal);
    }
  }

  if (lastError instanceof IntegrationProviderError) {
    throw lastError;
  }
  throw new IntegrationProviderError(
    `Request to ${url} failed: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
    'request_failed',
    false,
  );
}

function parseRateLimitHeaders(headers: Headers): IntegrationRateLimitInfo {
  const limit = headers.get('x-ratelimit-limit') ?? headers.get('ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining') ?? headers.get('ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset') ?? headers.get('ratelimit-reset');

  return {
    limit: limit ? Number(limit) : undefined,
    remaining: remaining ? Number(remaining) : undefined,
    resetAt: reset ? new Date(Number(reset) * 1000) : undefined,
  };
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) {
    return undefined;
  }
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

async function parseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (text.trim().length === 0) {
    return {} as T;
  }
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return { raw: text } as T;
    }
  }
  return { raw: text } as T;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
      },
      { once: true },
    );
  });
}
