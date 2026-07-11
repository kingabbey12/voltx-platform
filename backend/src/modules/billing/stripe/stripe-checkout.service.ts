import { BadRequestException, Injectable } from '@nestjs/common';
import { StripeClientService } from './stripe-client.service';
import { StripeCustomerService } from './stripe-customer.service';
import { BillingAccountService } from '../billing-account.service';
import { PlanService } from '../plan.service';
import { SessionRepository } from '../session.repository';
import { CheckoutSessionEntity, CustomerPortalSessionEntity } from '../entities/session.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class StripeCheckoutService {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly stripeCustomerService: StripeCustomerService,
    private readonly billingAccountService: BillingAccountService,
    private readonly planService: PlanService,
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Subscription-mode Stripe Checkout for upgrading off Free/trial onto a
   * paid plan (or changing plan + seat count) — the hosted Stripe page
   * handles collecting a real payment method; the actual local
   * Subscription row is only ever written from the webhook (Phase 2's
   * StripeWebhookProcessor on `checkout.session.completed`), never
   * optimistically here, so it can never drift from what Stripe actually
   * charged. successUrl/cancelUrl are supplied by the caller (web/mobile
   * client) rather than a hardcoded backend config value — same
   * client-supplies-its-own-redirect convention already used by
   * IntegrationConnectionService's OAuth `redirectUri`.
   */
  async createCheckoutSession(
    organizationId: string,
    planKey: string,
    seats: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSessionEntity> {
    const billingAccount =
      await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const plan = await this.planService.getPlanByKeyOrThrow(planKey);
    if (!plan.stripePriceIdMonthly) {
      throw new BadRequestException(
        `Plan "${planKey}" has no Stripe price configured yet — set it up in the Stripe dashboard first.`,
      );
    }

    const stripeCustomerId = await this.stripeCustomerService.ensureStripeCustomer(billingAccount);

    const session = await this.stripeClientService.client.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceIdMonthly, quantity: Math.max(1, seats) }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organizationId, planId: plan.id, planKey: plan.key },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    const created = await this.sessionRepository.createCheckoutSession({
      organizationId,
      billingAccountId: billingAccount.id,
      planId: plan.id,
      stripeSessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      metadata: { planKey: plan.key, seats },
    });

    await this.auditService.record({
      action: 'billing.checkout.create',
      resource: 'billing_checkout_session',
      resourceId: created.id,
      metadata: { planKey: plan.key, seats },
    });

    return created;
  }

  /** Launches the Stripe-hosted Customer Portal — proration/cancel/tax/payment-method UI Stripe already renders well, not rebuilt here. returnUrl is caller-supplied, same convention as createCheckoutSession's URLs. */
  async createPortalSession(
    organizationId: string,
    returnUrl: string,
  ): Promise<CustomerPortalSessionEntity> {
    const billingAccount =
      await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const stripeCustomerId = await this.stripeCustomerService.ensureStripeCustomer(billingAccount);

    const session = await this.stripeClientService.client.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    const created = await this.sessionRepository.createPortalSession({
      organizationId,
      billingAccountId: billingAccount.id,
      stripeSessionId: session.id,
      url: session.url,
    });

    await this.auditService.record({
      action: 'billing.portal.create',
      resource: 'billing_portal_session',
      resourceId: created.id,
    });

    return created;
  }
}
