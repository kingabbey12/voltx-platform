import { BadRequestException, Injectable } from '@nestjs/common';
import { StripeClientService } from './stripe-client.service';
import { BillingAccountService } from '../billing-account.service';
import { PlanService } from '../plan.service';
import { SubscriptionRepository } from '../subscription.repository';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { AuditService } from '../../audit/audit.service';

/**
 * Every method here requires the organization to already have a real
 * Stripe Subscription (created via Checkout, see StripeCheckoutService,
 * and mirrored locally by StripeWebhookDispatcherService on
 * `customer.subscription.created`) — a still-trialing, Stripe-less
 * subscription can only be changed by sending the org through Checkout,
 * not through these methods.
 */
@Injectable()
export class StripeSubscriptionService {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly billingAccountService: BillingAccountService,
    private readonly planService: PlanService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly auditService: AuditService,
  ) {}

  async changePlan(
    organizationId: string,
    planKey: string,
    seats: number,
    initiatedBy: string,
  ): Promise<SubscriptionEntity> {
    const subscription = await this.getStripeBackedSubscriptionOrThrow(organizationId);
    const fromPlan = await this.planService.getPlanByIdOrThrow(subscription.planId);
    const toPlan = await this.planService.getPlanByKeyOrThrow(planKey);
    if (!toPlan.stripePriceIdMonthly) {
      throw new BadRequestException(
        `Plan "${planKey}" has no Stripe price configured yet — set it up in the Stripe dashboard first.`,
      );
    }

    const stripeSubscription = await this.stripeClientService.client.subscriptions.retrieve(
      subscription.stripeSubscriptionId as string,
    );
    const currentItem = stripeSubscription.items.data[0];
    if (!currentItem) {
      throw new BadRequestException('Stripe subscription has no line items to update');
    }

    const updated = await this.stripeClientService.client.subscriptions.update(
      subscription.stripeSubscriptionId as string,
      {
        items: [
          { id: currentItem.id, price: toPlan.stripePriceIdMonthly, quantity: Math.max(1, seats) },
        ],
        proration_behavior: 'create_prorations',
      },
    );

    const changeType = toPlan.sortOrder > fromPlan.sortOrder ? 'UPGRADE' : 'DOWNGRADE';
    const updatedItem = updated.items.data[0];
    const result = await this.subscriptionRepository.update(subscription.id, {
      planId: toPlan.id,
      seats: Math.max(1, seats),
      ...(updatedItem
        ? {
            currentPeriodStart: new Date(updatedItem.current_period_start * 1000),
            currentPeriodEnd: new Date(updatedItem.current_period_end * 1000),
          }
        : {}),
      status: mapStripeStatus(updated.status),
    });

    await this.subscriptionRepository.recordChange({
      subscriptionId: subscription.id,
      fromPlanId: fromPlan.id,
      toPlanId: toPlan.id,
      changeType,
      effectiveAt: new Date(),
      initiatedBy,
      metadata: { fromPlanKey: fromPlan.key, toPlanKey: toPlan.key, seats },
    });

    await this.auditService.record({
      action: `billing.subscription.${changeType.toLowerCase()}`,
      resource: 'billing_subscription',
      resourceId: subscription.id,
      metadata: { fromPlanKey: fromPlan.key, toPlanKey: toPlan.key, seats },
    });

    return result;
  }

  async cancel(
    organizationId: string,
    atPeriodEnd: boolean,
    initiatedBy: string,
  ): Promise<SubscriptionEntity> {
    const subscription = await this.getStripeBackedSubscriptionOrThrow(organizationId);

    const updated = atPeriodEnd
      ? await this.stripeClientService.client.subscriptions.update(
          subscription.stripeSubscriptionId as string,
          { cancel_at_period_end: true },
        )
      : await this.stripeClientService.client.subscriptions.cancel(
          subscription.stripeSubscriptionId as string,
        );

    const result = await this.subscriptionRepository.update(subscription.id, {
      status: mapStripeStatus(updated.status),
      cancelAtPeriodEnd: updated.cancel_at_period_end ?? atPeriodEnd,
      canceledAt: updated.canceled_at ? new Date(updated.canceled_at * 1000) : new Date(),
    });

    await this.subscriptionRepository.recordChange({
      subscriptionId: subscription.id,
      fromPlanId: subscription.planId,
      changeType: 'CANCEL',
      effectiveAt: new Date(),
      initiatedBy,
      metadata: { atPeriodEnd },
    });

    await this.auditService.record({
      action: 'billing.subscription.cancel',
      resource: 'billing_subscription',
      resourceId: subscription.id,
      metadata: { atPeriodEnd },
    });

    return result;
  }

  async resume(organizationId: string, initiatedBy: string): Promise<SubscriptionEntity> {
    const subscription = await this.getStripeBackedSubscriptionOrThrow(organizationId);

    const updated = await this.stripeClientService.client.subscriptions.update(
      subscription.stripeSubscriptionId as string,
      { cancel_at_period_end: false },
    );

    const result = await this.subscriptionRepository.update(subscription.id, {
      status: mapStripeStatus(updated.status),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });

    await this.subscriptionRepository.recordChange({
      subscriptionId: subscription.id,
      toPlanId: subscription.planId,
      changeType: 'RESUME',
      effectiveAt: new Date(),
      initiatedBy,
      metadata: {},
    });

    await this.auditService.record({
      action: 'billing.subscription.resume',
      resource: 'billing_subscription',
      resourceId: subscription.id,
    });

    return result;
  }

  private async getStripeBackedSubscriptionOrThrow(
    organizationId: string,
  ): Promise<SubscriptionEntity> {
    // billingAccountService call validates the org has billing set up at
    // all before touching Stripe — cheap fail-fast, mirrors the checkout
    // service's own ordering.
    await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const subscription =
      await this.subscriptionRepository.findCurrentForOrganization(organizationId);
    if (!subscription) {
      throw new BadRequestException('No subscription found for this organization');
    }
    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        'This subscription has no active Stripe subscription yet — complete checkout first',
      );
    }
    return subscription;
  }
}

export function mapStripeStatus(status: string): SubscriptionEntity['status'] {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'unpaid':
      return 'UNPAID';
    case 'paused':
      return 'PAUSED';
    default:
      return 'ACTIVE';
  }
}
