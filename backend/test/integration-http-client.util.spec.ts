import { requestJson } from '../src/modules/integrations/provider/integration-http-client.util';
import { IntegrationProviderError } from '../src/modules/integrations/provider/integration-provider.types';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('requestJson', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the parsed body and status on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true })) as never;
    const result = await requestJson('https://api.example.com/resource');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.attempts).toBe(1);
  });

  it('parses rate-limit headers off the response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {}, { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '42' }),
      ) as never;
    const result = await requestJson('https://api.example.com/resource');
    expect(result.rateLimit.limit).toBe(100);
    expect(result.rateLimit.remaining).toBe(42);
  });

  it('retries on a 429 and succeeds on the next attempt', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as never;

    const result = await requestJson(
      'https://api.example.com/resource',
      {},
      { baseDelayMs: 5, maxRetries: 2 },
    );

    expect(result.status).toBe(200);
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors the Retry-After header when present', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as never;

    const startedAt = Date.now();
    const result = await requestJson(
      'https://api.example.com/resource',
      {},
      { maxRetries: 2, baseDelayMs: 1000 },
    );
    expect(result.status).toBe(200);
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it('retries on a 5xx response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: 'unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as never;

    const result = await requestJson(
      'https://api.example.com/resource',
      {},
      { baseDelayMs: 5, maxRetries: 2 },
    );
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws IntegrationProviderError after exhausting retries', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, { error: 'still down' })) as never;

    await expect(
      requestJson('https://api.example.com/resource', {}, { baseDelayMs: 5, maxRetries: 1 }),
    ).rejects.toThrow(IntegrationProviderError);
  });

  it('does not retry a non-retryable 4xx response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'not found' }));
    global.fetch = fetchMock as never;

    await expect(requestJson('https://api.example.com/resource')).rejects.toThrow(
      IntegrationProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a raw-text body when the response is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('plain text body'),
    }) as never;

    const result = await requestJson<{ raw: string }>('https://api.example.com/resource');
    expect(result.body.raw).toBe('plain text body');
  });

  it('propagates an already-aborted signal without retrying', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    global.fetch = fetchMock as never;

    await expect(
      requestJson(
        'https://api.example.com/resource',
        {},
        { signal: controller.signal, maxRetries: 3 },
      ),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
