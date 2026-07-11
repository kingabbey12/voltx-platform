import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';

describe('StripeClientService', () => {
  function buildConfig(values: Record<string, string>): ConfigService {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
    } as unknown as ConfigService;
  }

  it('throws ServiceUnavailableException instead of crashing when no API key is configured', () => {
    const service = new StripeClientService(buildConfig({}));

    expect(() => service.client).toThrow(ServiceUnavailableException);
  });

  it('lazily constructs and memoizes a single Stripe instance once an API key is configured', () => {
    const service = new StripeClientService(
      buildConfig({ 'billing.stripe.apiKey': 'sk_test_123' }),
    );

    const first = service.client;
    const second = service.client;

    expect(first).toBe(second);
  });

  it('throws ServiceUnavailableException from getWebhookSecretOrThrow when unconfigured', () => {
    const service = new StripeClientService(buildConfig({}));

    expect(() => service.getWebhookSecretOrThrow()).toThrow(ServiceUnavailableException);
  });

  it('returns the configured webhook secret', () => {
    const service = new StripeClientService(
      buildConfig({ 'billing.stripe.webhookSecret': 'whsec_abc' }),
    );

    expect(service.getWebhookSecretOrThrow()).toBe('whsec_abc');
  });
});
