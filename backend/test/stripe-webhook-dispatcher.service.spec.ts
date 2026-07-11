import Stripe from 'stripe';
import {
  StripeWebhookDispatcherService,
  mapInvoiceStatus,
} from '../src/modules/billing/stripe/stripe-webhook-dispatcher.service';
import { BillingAccountRepository } from '../src/modules/billing/billing-account.repository';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';
import { InvoiceRepository } from '../src/modules/billing/invoice.repository';
import { PaymentRepository } from '../src/modules/billing/payment.repository';
import { PaymentMethodRepository } from '../src/modules/billing/payment-method.repository';
import { SessionRepository } from '../src/modules/billing/session.repository';
import { PlanService } from '../src/modules/billing/plan.service';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';

describe('mapInvoiceStatus', () => {
  it.each([
    ['open', 'OPEN'],
    ['paid', 'PAID'],
    ['void', 'VOID'],
    ['uncollectible', 'UNCOLLECTIBLE'],
    ['draft', 'DRAFT'],
    [null, 'DRAFT'],
  ])('maps Stripe invoice status %s to %s', (stripeStatus, expected) => {
    expect(mapInvoiceStatus(stripeStatus as never)).toBe(expected);
  });
});

function buildEvent(type: string, object: unknown): Stripe.Event {
  return { id: 'evt_123', type, data: { object } } as unknown as Stripe.Event;
}

describe('StripeWebhookDispatcherService', () => {
  let billingAccountRepository: jest.Mocked<BillingAccountRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let paymentMethodRepository: jest.Mocked<PaymentMethodRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let planService: jest.Mocked<PlanService>;
  let notificationService: jest.Mocked<NotificationService>;
  let authContextRepository: jest.Mocked<AuthContextRepository>;
  let service: StripeWebhookDispatcherService;

  const billingAccount = { id: 'ba-1', organizationId: 'org-1' } as never;

  beforeEach(() => {
    billingAccountRepository = { findByStripeCustomerId: jest.fn() } as never;
    subscriptionRepository = {
      findByStripeSubscriptionId: jest.fn(),
      findCurrentForOrganization: jest.fn(),
      update: jest.fn(),
      recordChange: jest.fn(),
    } as never;
    invoiceRepository = {
      upsertByStripeInvoiceId: jest.fn(),
      addItem: jest.fn(),
      findByStripeInvoiceId: jest.fn(),
    } as never;
    paymentRepository = {
      upsertByStripePaymentIntentId: jest.fn(),
      setRefundedAmount: jest.fn(),
      findByStripePaymentIntentId: jest.fn(),
    } as never;
    paymentMethodRepository = {
      create: jest.fn(),
      findByStripePaymentMethodId: jest.fn(),
    } as never;
    sessionRepository = { markCheckoutSessionComplete: jest.fn() } as never;
    planService = { findByStripePriceId: jest.fn() } as never;
    notificationService = { create: jest.fn() } as never;
    authContextRepository = {
      listActiveUserIdsWithPermission: jest.fn().mockResolvedValue([]),
    } as never;

    service = new StripeWebhookDispatcherService(
      billingAccountRepository,
      subscriptionRepository,
      invoiceRepository,
      paymentRepository,
      paymentMethodRepository,
      sessionRepository,
      planService,
      notificationService,
      authContextRepository,
    );
  });

  it('ignores an unrecognized event type without throwing', async () => {
    await expect(service.dispatch(buildEvent('some.unhandled.event', {}))).resolves.toBeUndefined();
  });

  it('marks the checkout session complete on checkout.session.completed', async () => {
    await service.dispatch(buildEvent('checkout.session.completed', { id: 'cs_123' }));

    expect(sessionRepository.markCheckoutSessionComplete).toHaveBeenCalledWith('cs_123');
  });

  it('links a newly-seen Stripe subscription to the org current subscription row', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(billingAccount);
    subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue(null);
    subscriptionRepository.findCurrentForOrganization.mockResolvedValue({
      id: 'sub-1',
      planId: 'plan-old',
      trialStart: null,
      trialEnd: null,
    } as never);
    planService.findByStripePriceId.mockResolvedValue({ id: 'plan-new' } as never);

    await service.dispatch(
      buildEvent('customer.subscription.created', {
        id: 'sub_stripe_1',
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
        items: {
          data: [
            {
              price: { id: 'price_123' },
              quantity: 2,
              current_period_start: 1893456000,
              current_period_end: 1896134400,
            },
          ],
        },
      }),
    );

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        stripeSubscriptionId: 'sub_stripe_1',
        planId: 'plan-new',
        status: 'ACTIVE',
        seats: 2,
      }),
    );
  });

  it('does nothing for a subscription event when the org has no BillingAccount', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(null);

    await service.dispatch(
      buildEvent('customer.subscription.updated', {
        id: 'sub_stripe_1',
        customer: 'cus_unknown',
        items: { data: [] },
      }),
    );

    expect(subscriptionRepository.update).not.toHaveBeenCalled();
  });

  it('marks the local subscription CANCELED on customer.subscription.deleted', async () => {
    subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue({
      id: 'sub-1',
      organizationId: 'org-1',
      planId: 'plan-1',
    } as never);

    await service.dispatch(
      buildEvent('customer.subscription.deleted', { id: 'sub_stripe_1', customer: 'cus_123' }),
    );

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({ status: 'CANCELED' }),
    );
    expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: 'CANCEL' }),
    );
  });

  it('upserts the invoice and adds line items only the first time it is seen', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(billingAccount);
    invoiceRepository.findByStripeInvoiceId.mockResolvedValue(null);
    invoiceRepository.upsertByStripeInvoiceId.mockResolvedValue({ id: 'invoice-1' } as never);

    await service.dispatch(
      buildEvent('invoice.paid', {
        id: 'in_123',
        customer: 'cus_123',
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
      }),
    );

    expect(invoiceRepository.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'invoice-1', amount: 99 }),
    );
  });

  it('does not duplicate invoice items when the invoice was already seen', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(billingAccount);
    invoiceRepository.findByStripeInvoiceId.mockResolvedValue({ id: 'invoice-1' } as never);
    invoiceRepository.upsertByStripeInvoiceId.mockResolvedValue({ id: 'invoice-1' } as never);

    await service.dispatch(
      buildEvent('invoice.paid', {
        id: 'in_123',
        customer: 'cus_123',
        status: 'paid',
        amount_due: 9900,
        amount_paid: 9900,
        amount_remaining: 0,
        currency: 'usd',
        lines: { data: [{ description: 'Professional plan', amount: 9900, quantity: 1 }] },
      }),
    );

    expect(invoiceRepository.addItem).not.toHaveBeenCalled();
  });

  it('records a FAILED payment and notifies billing contacts on payment_intent.payment_failed', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(billingAccount);
    authContextRepository.listActiveUserIdsWithPermission.mockResolvedValue(['user-1']);

    await service.dispatch(
      buildEvent('payment_intent.payment_failed', {
        id: 'pi_123',
        customer: 'cus_123',
        amount: 9900,
        currency: 'usd',
        last_payment_error: { code: 'card_declined', message: 'Your card was declined.' },
      }),
    );

    expect(paymentRepository.upsertByStripePaymentIntentId).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', failureCode: 'card_declined' }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', category: 'BILLING' }),
    );
  });

  it('creates a local PaymentMethod mirror on payment_method.attached', async () => {
    billingAccountRepository.findByStripeCustomerId.mockResolvedValue(billingAccount);
    paymentMethodRepository.findByStripePaymentMethodId.mockResolvedValue(null);

    await service.dispatch(
      buildEvent('payment_method.attached', {
        id: 'pm_123',
        customer: 'cus_123',
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      }),
    );

    expect(paymentMethodRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripePaymentMethodId: 'pm_123', brand: 'visa' }),
    );
  });

  it('marks a payment REFUNDED when the full amount is refunded', async () => {
    paymentRepository.findByStripePaymentIntentId.mockResolvedValue({
      id: 'payment-1',
      organizationId: 'org-1',
    } as never);

    await service.dispatch(
      buildEvent('charge.refunded', {
        payment_intent: 'pi_123',
        amount: 9900,
        amount_refunded: 9900,
      }),
    );

    expect(paymentRepository.setRefundedAmount).toHaveBeenCalledWith('payment-1', 99, 'REFUNDED');
  });

  it('marks a payment PARTIALLY_REFUNDED when only part of the amount is refunded', async () => {
    paymentRepository.findByStripePaymentIntentId.mockResolvedValue({
      id: 'payment-1',
      organizationId: 'org-1',
    } as never);

    await service.dispatch(
      buildEvent('charge.refunded', {
        payment_intent: 'pi_123',
        amount: 9900,
        amount_refunded: 5000,
      }),
    );

    expect(paymentRepository.setRefundedAmount).toHaveBeenCalledWith(
      'payment-1',
      50,
      'PARTIALLY_REFUNDED',
    );
  });
});
