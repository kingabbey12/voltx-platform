import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { EncryptionService } from '../../security/encryption.service';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
}

interface StripeEventPayload {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
}

@Injectable()
export class StripeConnector implements IntegrationProvider {
  readonly key = 'STRIPE' as const;
  readonly authType = 'API_KEY' as const;
  readonly displayName = 'Stripe';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'create_customer',
        description: 'Create a Stripe customer.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Customer email address.', required: true },
            name: { type: 'string', description: 'Customer name.' },
          },
        },
      },
      {
        name: 'list_payments',
        description: 'List recent Stripe charges.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max charges to return, default 10.' },
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
    switch (actionName) {
      case 'create_customer':
        return this.createCustomer(input, context);
      case 'list_payments':
        return this.listPayments(input, context);
      default:
        throw new IntegrationProviderError(
          `Unknown Stripe action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${STRIPE_API_BASE_URL}/balance`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Stripe health check failed',
      };
    }
  }

  /** Stripe's webhook scheme: `Stripe-Signature: t=<timestamp>,v1=<hmac>` computed over `${timestamp}.${rawBody}`. */
  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    const header = headers['stripe-signature'];
    if (!header) {
      return false;
    }

    const parts = Object.fromEntries(
      header.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key, value];
      }),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) {
      return false;
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > SIGNATURE_MAX_AGE_SECONDS) {
      return false;
    }

    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return EncryptionService.safeEqual(expected, signature);
  }

  parseWebhookPayload(_headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[] {
    const event = JSON.parse(rawBody) as StripeEventPayload;
    if (event.type !== 'payment_intent.succeeded' && event.type !== 'charge.succeeded') {
      return [];
    }

    const object = event.data.object as {
      id?: string;
      amount?: number;
      currency?: string;
      customer?: string;
    };
    return [
      {
        type: 'PAYMENT_RECEIVED',
        externalId: event.id,
        occurredAt: new Date(event.created * 1000),
        payload: {
          amount: object.amount,
          currency: object.currency,
          customer: object.customer,
          objectId: object.id,
        },
      },
    ];
  }

  private async createCustomer(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string }> {
    const params = new URLSearchParams();
    params.set('email', asString(input.email, ''));
    if (input.name) {
      params.set('name', asString(input.name));
    }

    const result = await requestJson<StripeCustomer>(
      `${STRIPE_API_BASE_URL}/customers`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(context),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
      { signal: context.signal },
    );
    return { id: result.body.id };
  }

  private async listPayments(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ charges: Array<{ id: string; amount: number; currency: string }> }> {
    const limit = Number(input.limit ?? 10);
    const result = await requestJson<{
      data: Array<{ id: string; amount: number; currency: string }>;
    }>(
      `${STRIPE_API_BASE_URL}/charges?limit=${limit}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return { charges: result.body.data };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.apiKey ?? ''}` };
  }
}
