import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies an inbound Voltx webhook delivery's `X-Voltx-Signature` header
 * (`sha256=<hex>` over the exact raw request body) against the endpoint's
 * own signing secret — mirrors the backend's signing scheme exactly
 * (src/common/utils/hmac.util.ts). Always verify against the raw body
 * bytes/string as received, before any JSON re-serialization, since
 * re-serializing can change byte-for-byte formatting and break the check.
 */
export function verifyWebhookSignature(secret: string, rawBody: string, signatureHeader: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
