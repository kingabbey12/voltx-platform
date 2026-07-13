import { signWebhookPayload, verifyWebhookSignature } from '../src/common/utils/hmac.util';

describe('hmac.util (webhook signing)', () => {
  const secret = 'whsec_test_secret';
  const rawBody = JSON.stringify({ eventType: 'sales.lead.created', payload: { id: '1' } });

  it('signs a payload as sha256=<hex>', () => {
    const signature = signWebhookPayload(secret, rawBody);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('produces a deterministic signature for the same secret and body', () => {
    expect(signWebhookPayload(secret, rawBody)).toBe(signWebhookPayload(secret, rawBody));
  });

  it('verifies a correctly signed payload', () => {
    const signature = signWebhookPayload(secret, rawBody);
    expect(verifyWebhookSignature(secret, rawBody, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const signature = signWebhookPayload('a-different-secret', rawBody);
    expect(verifyWebhookSignature(secret, rawBody, signature)).toBe(false);
  });

  it('rejects a signature for a body that was tampered with after signing', () => {
    const signature = signWebhookPayload(secret, rawBody);
    const tamperedBody = JSON.stringify({ eventType: 'sales.lead.created', payload: { id: '2' } });
    expect(verifyWebhookSignature(secret, tamperedBody, signature)).toBe(false);
  });

  it('rejects a malformed signature header', () => {
    expect(verifyWebhookSignature(secret, rawBody, 'not-a-real-signature')).toBe(false);
  });
});
