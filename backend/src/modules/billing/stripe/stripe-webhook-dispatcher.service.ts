import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { NotificationService } from '../../notifications/notification.service';
import { BillingAccountRepository } from '../billing-account.repository';
import { InvoiceRepository } from '../invoice.repository';
import { PaymentRepository } from '../payment.repository';
import { PaymentMethodRepository } from '../payment-method.repository';
import { SessionRepository } from '../session.repository';
import { SubscriptionRepository } from '../subscription.repository';
import { PlanService } from '../plan.service';
import { BillingAccountEntity } from '../entities/billing-account.entity';
import { InvoiceStatus } from '../entities/invoice.entity';
import { PaymentStatus } from '../entities/payment.entity';
import { mapStripeStatus } from './stripe-subscription.service';
import { mapPaymentMethodType } from './stripe-payment-method.service';

/**
 * Dispatches a verified, deduplicated Stripe event (see
 * StripeWebhookController / BillingEventRepository.createIfNew) by
 * `event.type` into local state mutations — this is where every
 * "did Stripe just do X" fact gets written to Invoice/Payment/
 * Subscription/PaymentMethod. Runs from StripeWebhookProcessor (BullMQ
 * worker) when Redis is enabled, or synchronously inline from the
 * controller otherwise (see billing.module.ts's REDIS_ENABLED gate) —
 * either way, this is the one place event-type handling lives.
 */
@Injectable()
export class StripeWebhookDispatcherService {
  private readonly logger = new Logger(StripeWebhookDispatcherService.name);

  constructor(
    private readonly billingAccountRepository: BillingAccountRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly planService: PlanService,
    private readonly notificationService: NotificationService,
    private readonly authContextRepository: AuthContextRepository,
  ) {}

  async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpserted(event.data.object);
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        return;
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
        await this.handleInvoiceEvent(event.data.object, event.type);
        return;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntent(event.data.object, 'SUCCEEDED');
        return;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntent(event.data.object, 'FAILED');
        return;
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object);
        return;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object);
        return;
      default:
        this.logger.log({ eventType: event.type }, 'Unhandled Stripe webhook event type — ignored');
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    await this.sessionRepository.markCheckoutSessionComplete(session.id);
    // The Subscription row itself is linked to Stripe via
    // customer.subscription.created, which Stripe always fires alongside
    // subscription-mode Checkout completion — nothing further here.
  }

  private async handleSubscriptionUpserted(subscription: Stripe.Subscription): Promise<void> {
    const billingAccount = await this.resolveBillingAccount(subscription.customer);
    if (!billingAccount) return;

    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? await this.planService.findByStripePriceId(priceId) : null;
    const seats = subscription.items.data[0]?.quantity ?? 1;
    const status = mapStripeStatus(subscription.status);

    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscription.id);
    const target =
      existing ??
      (await this.subscriptionRepository.findCurrentForOrganization(billingAccount.organizationId));
    if (!target) {
      this.logger.warn(
        { organizationId: billingAccount.organizationId, stripeSubscriptionId: subscription.id },
        'Received subscription event for an organization with no local Subscription row',
      );
      return;
    }

    const item = subscription.items.data[0];
    await this.subscriptionRepository.update(target.id, {
      stripeSubscriptionId: subscription.id,
      planId: plan?.id ?? target.planId,
      status,
      seats,
      ...(item
        ? {
            currentPeriodStart: new Date(item.current_period_start * 1000),
            currentPeriodEnd: new Date(item.current_period_end * 1000),
          }
        : {}),
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : target.trialStart,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : target.trialEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscription.id);
    if (!existing) return;

    await this.subscriptionRepository.update(existing.id, {
      status: 'CANCELED',
      canceledAt: new Date(),
    });
    await this.subscriptionRepository.recordChange({
      subscriptionId: existing.id,
      fromPlanId: existing.planId,
      changeType: 'CANCEL',
      effectiveAt: new Date(),
      metadata: { source: 'stripe_webhook' },
    });

    await this.notifyBillingContacts(
      existing.organizationId,
      'Subscription canceled',
      'Your Stripe subscription has been canceled.',
    );
  }

  private async handleInvoiceEvent(
    invoice: Stripe.Invoice,
    eventType: 'invoice.paid' | 'invoice.payment_failed' | 'invoice.finalized',
  ): Promise<void> {
    const billingAccount = await this.resolveBillingAccount(invoice.customer);
    if (!billingAccount || !invoice.id) return;

    const existing = await this.invoiceRepository.findByStripeInvoiceId(invoice.id);
    const localInvoice = await this.invoiceRepository.upsertByStripeInvoiceId({
      organizationId: billingAccount.organizationId,
      billingAccountId: billingAccount.id,
      stripeInvoiceId: invoice.id,
      status: mapInvoiceStatus(invoice.status),
      amountDue: invoice.amount_due / 100,
      amountPaid: invoice.amount_paid / 100,
      amountRemaining: invoice.amount_remaining / 100,
      currency: invoice.currency,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    });

    if (!existing) {
      for (const line of invoice.lines.data) {
        await this.invoiceRepository.addItem({
          invoiceId: localInvoice.id,
          description: line.description ?? 'Line item',
          amount: line.amount / 100,
          quantity: line.quantity ?? 1,
        });
      }
    }

    if (eventType === 'invoice.paid') {
      await this.notifyBillingContacts(
        billingAccount.organizationId,
        'Invoice paid',
        `Invoice for $${(invoice.amount_paid / 100).toFixed(2)} was paid successfully.`,
      );
    } else if (eventType === 'invoice.payment_failed') {
      await this.notifyBillingContacts(
        billingAccount.organizationId,
        'Invoice payment failed',
        `A payment of $${(invoice.amount_due / 100).toFixed(2)} could not be collected — please update your payment method.`,
      );
    }
  }

  private async handlePaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
    status: PaymentStatus,
  ): Promise<void> {
    const billingAccount = await this.resolveBillingAccount(paymentIntent.customer);
    if (!billingAccount) return;

    await this.paymentRepository.upsertByStripePaymentIntentId({
      organizationId: billingAccount.organizationId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status,
      failureCode: paymentIntent.last_payment_error?.code ?? null,
      failureMessage: paymentIntent.last_payment_error?.message ?? null,
    });

    if (status === 'FAILED') {
      await this.notifyBillingContacts(
        billingAccount.organizationId,
        'Payment failed',
        paymentIntent.last_payment_error?.message ?? 'A payment attempt failed.',
      );
    }
  }

  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (!paymentMethod.customer) return;
    const billingAccount = await this.resolveBillingAccount(paymentMethod.customer);
    if (!billingAccount) return;

    const existing = await this.paymentMethodRepository.findByStripePaymentMethodId(
      paymentMethod.id,
    );
    if (existing) return;

    await this.paymentMethodRepository.create({
      organizationId: billingAccount.organizationId,
      billingAccountId: billingAccount.id,
      stripePaymentMethodId: paymentMethod.id,
      type: mapPaymentMethodType(paymentMethod.type),
      brand: paymentMethod.card?.brand ?? null,
      last4: paymentMethod.card?.last4 ?? null,
      expMonth: paymentMethod.card?.exp_month ?? null,
      expYear: paymentMethod.card?.exp_year ?? null,
    });
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    if (!charge.payment_intent) return;
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntentId);
    if (!payment) return;

    const status: PaymentStatus =
      charge.amount_refunded >= charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await this.paymentRepository.setRefundedAmount(
      payment.id,
      charge.amount_refunded / 100,
      status,
    );

    await this.notifyBillingContacts(
      payment.organizationId,
      'Payment refunded',
      `A refund of $${(charge.amount_refunded / 100).toFixed(2)} was processed.`,
    );
  }

  private async resolveBillingAccount(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  ): Promise<BillingAccountEntity | null> {
    if (!customer) return null;
    const customerId = typeof customer === 'string' ? customer : customer.id;
    return this.billingAccountRepository.findByStripeCustomerId(customerId);
  }

  /** Best-effort — must never throw back into the webhook processing path. */
  private async notifyBillingContacts(
    organizationId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const recipientUserIds = await this.authContextRepository.listActiveUserIdsWithPermission(
        organizationId,
        'billing.subscription.manage',
      );
      await Promise.all(
        recipientUserIds.map((userId) =>
          this.notificationService.create({
            organizationId,
            userId,
            category: 'BILLING',
            title,
            body,
          }),
        ),
      );
    } catch (error) {
      this.logger.warn({ err: error, organizationId }, 'Failed to notify billing contacts');
    }
  }
}

export function mapInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
  switch (status) {
    case 'open':
      return 'OPEN';
    case 'paid':
      return 'PAID';
    case 'void':
      return 'VOID';
    case 'uncollectible':
      return 'UNCOLLECTIBLE';
    default:
      return 'DRAFT';
  }
}
