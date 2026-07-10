import { createHmac } from 'node:crypto';
import { EncryptionService } from '../../integrations/security/encryption.service';

/**
 * Twilio's webhook signing scheme (distinct from Slack/WhatsApp/Teams,
 * all of which HMAC the raw JSON body): HMAC-SHA1, keyed by the
 * connection's own Auth Token, over the exact webhook URL Twilio was
 * configured to call concatenated with every POST parameter's key+value
 * (sorted alphabetically by key, no separators, no encoding) appended
 * directly — then base64-encoded and compared against
 * X-Twilio-Signature. See
 * https://www.twilio.com/docs/usage/security#validating-requests.
 */
export function verifyTwilioSignature(
  fullUrl: string,
  rawFormBody: string,
  signatureHeader: string | undefined,
  authToken: string,
): boolean {
  if (!signatureHeader) return false;

  const params = new URLSearchParams(rawFormBody);
  const sortedKeys = Array.from(params.keys()).sort();

  let data = fullUrl;
  for (const key of sortedKeys) {
    data += key + (params.get(key) ?? '');
  }

  const expected = createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  return EncryptionService.safeEqual(expected, signatureHeader);
}
