import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shared HMAC-SHA256 signing/verification for outbound webhook deliveries
 * — `X-Voltx-Signature: sha256=<hex>` over the exact raw JSON body,
 * mirroring the scheme `generic-webhook.connector.ts` already uses for
 * Voltx-originated outbound signatures. This is the first *shared*
 * consumer of that scheme; the ~8 existing ad hoc HMAC implementations
 * across inbound connector webhooks (Slack, Stripe, GitHub, Twilio, etc.)
 * each verify a different provider's own signature format and are
 * intentionally left untouched — consolidating those is a separate,
 * unrelated refactor.
 */
export function signWebhookPayload(secret: string, rawBody: string): string {
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
): boolean {
  const expected = signWebhookPayload(secret, rawBody);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
