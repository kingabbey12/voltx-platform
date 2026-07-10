import {
  classifyProviderError,
  extractProviderRequestId,
  friendlyMessageForCategory,
} from '../src/modules/ai/providers/provider-error-classifier';

describe('classifyProviderError', () => {
  it('classifies 401/403 status or key-related wording as invalid_api_key', () => {
    expect(classifyProviderError(401, 'unauthorized').category).toBe('invalid_api_key');
    expect(classifyProviderError(403, 'PERMISSION_DENIED').category).toBe('invalid_api_key');
    expect(classifyProviderError(400, 'x-api-key header is required').category).toBe(
      'invalid_api_key',
    );
    expect(classifyProviderError(401, 'unauthorized').retryable).toBe(false);
  });

  it('classifies 402 or billing/quota wording as insufficient_credits', () => {
    expect(classifyProviderError(402, 'payment required').category).toBe('insufficient_credits');
    expect(
      classifyProviderError(
        429,
        'You exceeded your current quota, please check your billing details',
      ).category,
    ).toBe('insufficient_credits');
  });

  it('classifies 429 without quota wording as rate_limited', () => {
    const result = classifyProviderError(429, 'Rate limit reached for requests');
    expect(result.category).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('classifies context-length wording as context_length_exceeded regardless of status', () => {
    const result = classifyProviderError(
      400,
      "This model's maximum context length is 128000 tokens",
    );
    expect(result.category).toBe('context_length_exceeded');
    expect(result.retryable).toBe(false);
  });

  it('classifies 5xx or overloaded wording as provider_unavailable', () => {
    expect(classifyProviderError(503, 'Service unavailable').category).toBe('provider_unavailable');
    expect(classifyProviderError(529, 'Overloaded').category).toBe('provider_unavailable');
  });

  it('classifies a missing status (network failure) as provider_unavailable', () => {
    const result = classifyProviderError(undefined, 'fetch failed');
    expect(result.category).toBe('provider_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('classifies an explicit timeout regardless of message content', () => {
    const result = classifyProviderError(undefined, 'The operation was aborted', true);
    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('falls back to unknown for unrecognized status/message combinations', () => {
    expect(classifyProviderError(418, "I'm a teapot").category).toBe('unknown');
  });

  it('never includes the raw message in the returned userMessage', () => {
    const rawSecretLike = 'sk-super-secret-detail-that-must-not-leak';
    const result = classifyProviderError(401, rawSecretLike);
    expect(result.userMessage).not.toContain(rawSecretLike);
  });
});

describe('friendlyMessageForCategory', () => {
  it('returns non-empty, category-specific text for every category', () => {
    const categories = [
      'invalid_api_key',
      'insufficient_credits',
      'rate_limited',
      'context_length_exceeded',
      'provider_unavailable',
      'timeout',
      'unknown',
    ] as const;

    const messages = categories.map((category) => friendlyMessageForCategory(category));
    expect(new Set(messages).size).toBe(categories.length);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

describe('extractProviderRequestId', () => {
  function fakeResponse(headers: Record<string, string>): Response {
    return { headers: new Headers(headers) } as Response;
  }

  it('prefers the x-request-id header', () => {
    const response = fakeResponse({ 'x-request-id': 'req-from-header' });
    expect(extractProviderRequestId(response, {})).toBe('req-from-header');
  });

  it('falls back to the request-id header', () => {
    const response = fakeResponse({ 'request-id': 'req-from-alt-header' });
    expect(extractProviderRequestId(response, {})).toBe('req-from-alt-header');
  });

  it('falls back to a request_id field in the body when no header is present', () => {
    const response = fakeResponse({});
    expect(extractProviderRequestId(response, { request_id: 'req-from-body' })).toBe(
      'req-from-body',
    );
  });

  it('returns undefined when no request id is available anywhere', () => {
    const response = fakeResponse({});
    expect(extractProviderRequestId(response, {})).toBeUndefined();
  });
});
