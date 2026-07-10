export type AIProviderErrorCategory =
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'context_length_exceeded'
  | 'provider_unavailable'
  | 'timeout'
  | 'unknown';

export interface ClassifiedProviderError {
  category: AIProviderErrorCategory;
  userMessage: string;
  retryable: boolean;
}

/**
 * User-facing text for each category — deliberately generic (no provider
 * name, no raw error text, no account/billing specifics) since these reach
 * the frontend verbatim. The original provider response is logged
 * separately by the caller and never included here.
 */
const FRIENDLY_MESSAGES: Record<AIProviderErrorCategory, string> = {
  invalid_api_key:
    'The AI service is misconfigured on our end. Our team has been notified — please try again shortly.',
  insufficient_credits:
    'The AI service is temporarily unable to process requests. Our team has been notified.',
  rate_limited: 'The AI service is busy right now. Please wait a moment and try again.',
  context_length_exceeded:
    'This conversation has grown too long for the AI to process. Try starting a new conversation or shortening your message.',
  provider_unavailable:
    'The AI service is temporarily unavailable. Please try again in a few minutes.',
  timeout: 'The AI took too long to respond. Please try again.',
  unknown: 'Something went wrong while talking to the AI. Please try again.',
};

/**
 * Classifies a failed provider call into one of a small set of actionable
 * categories, using the HTTP status as the primary signal (consistent
 * across providers) and a keyword scan of the raw message as a fallback
 * for providers that reuse one status for multiple failure modes (e.g.
 * OpenAI returns 429 for both real rate limiting and quota exhaustion).
 * Never include the raw message in the returned userMessage — callers log
 * the raw text separately for debugging.
 */
export function classifyProviderError(
  status: number | undefined,
  rawMessage: string,
  isTimeout = false,
): ClassifiedProviderError {
  if (isTimeout) {
    return toResult('timeout', true);
  }

  // No HTTP response was ever received (DNS failure, connection refused,
  // connection reset) — this is a reachability problem with the provider,
  // not a specific error type, so default it to "unavailable" rather than
  // falling through to the generic unknown bucket at the end.
  if (status === undefined) {
    return toResult('provider_unavailable', true);
  }

  const lower = rawMessage.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /\b(api key|x-api-key|authentication|unauthorized|invalid.*key|permission_denied)\b/.test(lower)
  ) {
    return toResult('invalid_api_key', false);
  }

  if (
    status === 402 ||
    /\b(insufficient.*quota|insufficient.*credit|billing|payment required|exceeded your current quota)\b/.test(
      lower,
    )
  ) {
    return toResult('insufficient_credits', false);
  }

  if (status === 429 || /\b(rate limit|too many requests|resource_exhausted)\b/.test(lower)) {
    return toResult('rate_limited', true);
  }

  if (
    /\b(context length|context_length_exceeded|maximum context|too long|token limit|max_tokens)\b/.test(
      lower,
    )
  ) {
    return toResult('context_length_exceeded', false);
  }

  if (
    (status !== undefined && status >= 500) ||
    /\b(overloaded|unavailable|internal server error)\b/.test(lower)
  ) {
    return toResult('provider_unavailable', true);
  }

  return toResult('unknown', false);
}

function toResult(category: AIProviderErrorCategory, retryable: boolean): ClassifiedProviderError {
  return { category, userMessage: FRIENDLY_MESSAGES[category], retryable };
}

/** For call sites that already know their category without an HTTP response to classify (e.g. a pre-flight "this provider has no API key configured" check). */
export function friendlyMessageForCategory(category: AIProviderErrorCategory): string {
  return FRIENDLY_MESSAGES[category];
}

/** Checks response headers first (OpenAI/Anthropic both send a request-id header), then common body field names, so debugging logs can be correlated with the provider's own dashboard/support. */
export function extractProviderRequestId(response: Response, body: unknown): string | undefined {
  const headerRequestId =
    response.headers.get('x-request-id') ?? response.headers.get('request-id');
  if (headerRequestId) {
    return headerRequestId;
  }

  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const fromBody = record.request_id ?? record.requestId;
    if (typeof fromBody === 'string') {
      return fromBody;
    }
  }

  return undefined;
}
