import { Injectable } from '@nestjs/common';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

/**
 * A generic outbound REST connector for arbitrary third-party APIs with
 * no dedicated connector — the "Trigger Webhook" / "REST API" workflow
 * step and AI tool. `apiKey` (if present on the credential) is sent as a
 * bearer token; callers needing custom auth schemes can pass headers
 * directly in the input.
 */
@Injectable()
export class GenericRestConnector implements IntegrationProvider {
  readonly key = 'REST_API' as const;
  readonly authType = 'API_KEY' as const;
  readonly displayName = 'Generic REST API';
  readonly supportsWebhooks = false;
  readonly supportsPolling = false;

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'call',
        description: 'Call an arbitrary HTTP/HTTPS REST endpoint.',
        inputSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', description: 'HTTP method, defaults to GET.' },
            url: { type: 'string', description: 'Absolute HTTP or HTTPS URL.', required: true },
            headers: { type: 'object', description: 'Optional request headers.' },
            body: { type: 'object', description: 'Optional JSON request body.' },
          },
        },
      },
    ];
  }

  async executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown> {
    if (actionName !== 'call') {
      throw new IntegrationProviderError(`Unknown REST action "${actionName}"`, 'unknown_action');
    }

    const url = normalizeUrl(asString(input.url, ''));
    const method = input.method ? asString(input.method).toUpperCase() : 'GET';
    const headers: Record<string, string> = {
      ...(context.credential.apiKey
        ? { Authorization: `Bearer ${context.credential.apiKey}` }
        : {}),
      ...(input.headers as Record<string, string> | undefined),
    };

    const result = await requestJson(
      url,
      {
        method,
        headers:
          input.body !== undefined ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      },
      { signal: context.signal },
    );

    return { status: result.status, body: result.body };
  }

  checkHealth(): Promise<IntegrationHealthResult> {
    return Promise.resolve({ healthy: true, latencyMs: 0 });
  }
}

function normalizeUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new IntegrationProviderError('Invalid URL', 'invalid_url');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new IntegrationProviderError(
      'Only HTTP and HTTPS URLs are allowed',
      'invalid_url_protocol',
    );
  }
  return parsed.toString();
}
