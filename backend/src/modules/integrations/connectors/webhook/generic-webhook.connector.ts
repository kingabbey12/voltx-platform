import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { EncryptionService } from '../../security/encryption.service';
import {
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationProvider,
} from '../../provider/integration-provider.types';

/**
 * A generic inbound webhook receiver for systems with no dedicated
 * connector — verification is a plain HMAC-SHA256 shared secret over the
 * raw body (header name `X-Voltx-Signature`), and every delivery becomes
 * a generic WEBHOOK_RECEIVED event. No outbound actions: this connector
 * exists purely to receive, not to call out.
 */
@Injectable()
export class GenericWebhookConnector implements IntegrationProvider {
  readonly key = 'WEBHOOK' as const;
  readonly authType = 'WEBHOOK_SECRET' as const;
  readonly displayName = 'Generic Webhook';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;

  listActions(): IntegrationActionDescriptor[] {
    return [];
  }

  executeAction(actionName: string): Promise<unknown> {
    return Promise.reject(
      new Error(`Generic webhook connector has no actions (got "${actionName}")`),
    );
  }

  checkHealth(): Promise<IntegrationHealthResult> {
    return Promise.resolve({ healthy: true, latencyMs: 0 });
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    const signature = headers['x-voltx-signature'];
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return EncryptionService.safeEqual(expected, signature);
  }

  parseWebhookPayload(_headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[] {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = { raw: rawBody };
    }

    return [
      {
        type: 'WEBHOOK_RECEIVED',
        externalId: typeof payload.id === 'string' ? payload.id : undefined,
        payload,
      },
    ];
  }
}
