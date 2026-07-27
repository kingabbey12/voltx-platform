import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Stripe from 'stripe';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { AuthMeResponseDto, LoginResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { createTestApp } from './create-test-app';
import { resetAndSeedAuthTestData } from './helpers/users-test.helper';

const WEBHOOK_SECRET = 'whsec_dummy_billing_test_webhook_secret';

/**
 * Real signature verification, end to end: uses the actual `stripe` SDK
 * (constructed with the dummy `STRIPE_API_KEY` from .env.test — the
 * signing/verification here is pure crypto, no network call, so no real
 * Stripe account is needed) to sign test payloads exactly the way Stripe
 * itself does, then posts them at the real, public
 * POST /billing/webhooks/stripe route.
 */
describe('Stripe billing webhook (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stripe = new Stripe('sk_test_dummy_key_for_e2e_signature_verification_only');

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function registerOrgWithStripeCustomer(stripeCustomerId: string): Promise<string> {
    const email = `billing-webhook-${Date.now()}-${Math.random()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Webhook',
        lastName: 'Tester',
        organizationName: 'Webhook Test Org',
      })
      .expect(201);
    const accessToken = (registerResponse.body as ApiSuccessResponse<LoginResponseDto>).data
      .accessToken;
    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const organizationId = (meResponse.body as ApiSuccessResponse<AuthMeResponseDto>).data
      .organizationId;

    // Simulates a checkout/StripeCustomerService round-trip having already
    // happened — the webhook dispatcher resolves organizationId purely via
    // this stripeCustomerId, so tests can seed it directly rather than
    // driving a real Stripe Checkout Session through this suite.
    await prisma.system.billingAccount.update({
      where: { organizationId },
      data: { stripeCustomerId },
    });

    return organizationId;
  }

  function signedPost(body: string) {
    const header = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: WEBHOOK_SECRET,
    });
    return request(app.getHttpServer())
      .post('/api/v1/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(body);
  }

  it('rejects a request with no stripe-signature header', async () => {
    const body = JSON.stringify({
      id: 'evt_missing_sig',
      type: 'invoice.paid',
      data: { object: {} },
    });

    await request(app.getHttpServer())
      .post('/api/v1/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
  });

  it('rejects a request with an invalid signature', async () => {
    const body = JSON.stringify({ id: 'evt_bad_sig', type: 'invoice.paid', data: { object: {} } });

    await request(app.getHttpServer())
      .post('/api/v1/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1893456000,v1=deadbeef')
      .send(body)
      .expect(400);
  });

  it('accepts a validly-signed event, processes it, and mirrors an Invoice locally', async () => {
    const stripeCustomerId = `cus_test_${Date.now()}`;
    const organizationId = await registerOrgWithStripeCustomer(stripeCustomerId);
    const eventId = `evt_test_${Date.now()}`;

    const body = JSON.stringify({
      id: eventId,
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_test_123',
          customer: stripeCustomerId,
          status: 'paid',
          amount_due: 9900,
          amount_paid: 9900,
          amount_remaining: 0,
          currency: 'usd',
          period_start: 1893456000,
          period_end: 1896134400,
          due_date: null,
          status_transitions: { paid_at: 1893456000 },
          hosted_invoice_url: 'https://stripe.test/invoice',
          invoice_pdf: 'https://stripe.test/invoice.pdf',
          lines: { data: [{ description: 'Professional plan', amount: 9900, quantity: 1 }] },
        },
      },
    });

    const response = await signedPost(body).expect(200);
    expect((response.body as { received: boolean }).received).toBe(true);

    const billingEvent = await prisma.system.billingEvent.findUnique({
      where: { stripeEventId: eventId },
    });
    expect(billingEvent).not.toBeNull();
    expect(billingEvent?.processedAt).not.toBeNull();

    const invoice = await prisma.system.invoice.findUnique({
      where: { stripeInvoiceId: 'in_test_123' },
    });
    expect(invoice?.organizationId).toBe(organizationId);
    expect(Number(invoice?.amountPaid)).toBe(99);
  });

  it('treats a duplicate delivery of the same event id as an idempotent no-op', async () => {
    const stripeCustomerId = `cus_test_${Date.now()}`;
    await registerOrgWithStripeCustomer(stripeCustomerId);
    const eventId = `evt_dup_${Date.now()}`;

    const body = JSON.stringify({
      id: eventId,
      type: 'invoice.paid',
      data: {
        object: {
          id: `in_dup_${Date.now()}`,
          customer: stripeCustomerId,
          status: 'paid',
          amount_due: 5000,
          amount_paid: 5000,
          amount_remaining: 0,
          currency: 'usd',
          lines: { data: [{ description: 'Line', amount: 5000, quantity: 1 }] },
        },
      },
    });

    await signedPost(body).expect(200);
    await signedPost(body).expect(200);

    const events = await prisma.system.billingEvent.findMany({ where: { stripeEventId: eventId } });
    expect(events).toHaveLength(1);
  });
});
