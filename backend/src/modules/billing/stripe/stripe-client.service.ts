import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * The single place a real `Stripe` SDK instance is constructed — every
 * other billing service calls through `client`, never `new Stripe()`
 * directly, so there's one place to swap API version/mocking in tests.
 * Constructed lazily (not at app boot) since `new Stripe('')` throws
 * immediately on an empty key — this environment may genuinely have no
 * Stripe key configured yet, and the app must still boot; only an actual
 * attempt to use Stripe should fail, with a clear, actionable error
 * (mirrors AgentRegistry's "no AI provider configured yet" pattern).
 */
@Injectable()
export class StripeClientService {
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  get client(): Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const apiKey = this.configService.get<string>('billing.stripe.apiKey', '');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Stripe is not configured — set STRIPE_API_KEY to enable billing.',
      );
    }

    this.stripe = new Stripe(apiKey);
    return this.stripe;
  }

  getWebhookSecretOrThrow(): string {
    const webhookSecret = this.configService.get<string>('billing.stripe.webhookSecret', '');
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhooks are not configured — set STRIPE_WEBHOOK_SECRET to enable billing.',
      );
    }
    return webhookSecret;
  }
}
