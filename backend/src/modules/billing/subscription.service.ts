import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionRepository } from './subscription.repository';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates the organization's very first subscription — a real,
   * locally-tracked trial on `plan`, with no Stripe Subscription object
   * yet (Phase 2's StripeSubscriptionService creates one the moment a
   * payment method is attached or the trial converts).
   */
  async createTrialSubscription(
    organizationId: string,
    billingAccountId: string,
    plan: PlanEntity,
    initiatedBy: string,
  ): Promise<SubscriptionEntity> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

    const subscription = await this.subscriptionRepository.create({
      organizationId,
      billingAccountId,
      planId: plan.id,
      status: 'TRIALING',
      seats: 1,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd,
    });

    await this.subscriptionRepository.recordChange({
      subscriptionId: subscription.id,
      toPlanId: plan.id,
      changeType: 'TRIAL_START',
      effectiveAt: now,
      initiatedBy,
      metadata: { planKey: plan.key, trialDays: plan.trialDays },
    });

    // recordWithExplicitActor, not record() — this fires during
    // registration, before any authenticated request/tenant context
    // exists to pull organizationId/userId from (same pattern
    // AuditRepository already documents for invitation-acceptance).
    await this.auditService.recordWithExplicitActor({
      organizationId,
      userId: initiatedBy,
      action: 'subscription.trial_start',
      resource: 'billing_subscription',
      resourceId: subscription.id,
      metadata: { planKey: plan.key, trialEnd: trialEnd.toISOString() },
    });

    return subscription;
  }

  async getCurrentForOrganizationOrThrow(organizationId: string): Promise<SubscriptionEntity> {
    const subscription =
      await this.subscriptionRepository.findCurrentForOrganization(organizationId);
    if (!subscription) {
      throw new NotFoundException(`No subscription found for organization "${organizationId}"`);
    }
    return subscription;
  }

  async getCurrentForCurrentOrganizationOrThrow(): Promise<SubscriptionEntity> {
    const subscription = await this.subscriptionRepository.findCurrentForCurrentOrganization();
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }
    return subscription;
  }

  async findExpiredTrials(now: Date = new Date()): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.findExpiredTrials(now);
  }

  async updateStatus(
    id: string,
    status: SubscriptionEntity['status'],
  ): Promise<SubscriptionEntity> {
    return this.subscriptionRepository.update(id, { status });
  }

  async recordChange(
    ...args: Parameters<SubscriptionRepository['recordChange']>
  ): ReturnType<SubscriptionRepository['recordChange']> {
    return this.subscriptionRepository.recordChange(...args);
  }
}
