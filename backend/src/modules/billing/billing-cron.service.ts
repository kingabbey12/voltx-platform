import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { UsageRecordRepository } from './usage-record.repository';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';
import { PlanService } from './plan.service';
import { PaymentMethodRepository } from './payment-method.repository';

const NIGHTLY_ROLLUP_CRON = '0 2 * * *';
const HOURLY_TRIAL_SWEEP_CRON = '0 * * * *';

/**
 * Two background sweeps, registered the same way
 * WorkflowSchedulerService registers its own cron jobs
 * (SchedulerRegistry.addCronJob at onModuleInit):
 *
 * - Nightly UsageSnapshot rollup: freezes each org's current-period usage
 *   per feature so usage charts (web/mobile) don't re-aggregate raw
 *   UsageRecord rows on every request.
 * - Hourly trial-expiry sweep: any TRIALING subscription whose trialEnd
 *   has passed either converts (a payment method is already on file — a
 *   real Stripe subscription will follow from Checkout/the customer
 *   portal, or already exists) or is downgraded to the Free plan
 *   locally, recording a TRIAL_END SubscriptionChange either way.
 */
@Injectable()
export class BillingCronService implements OnModuleInit {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly subscriptionService: SubscriptionService,
    private readonly planService: PlanService,
    private readonly paymentMethodRepository: PaymentMethodRepository,
  ) {}

  onModuleInit(): void {
    this.registerJob('billing-usage-snapshot-nightly', NIGHTLY_ROLLUP_CRON, () =>
      this.rollupUsageSnapshots(),
    );
    this.registerJob('billing-trial-expiry-hourly', HOURLY_TRIAL_SWEEP_CRON, () =>
      this.sweepExpiredTrials(),
    );
  }

  private registerJob(name: string, cronExpression: string, fn: () => Promise<void>): void {
    if (this.schedulerRegistry.doesExist('cron', name)) {
      this.schedulerRegistry.deleteCronJob(name);
    }
    const job = new CronJob(cronExpression, () => {
      void fn().catch((error: unknown) => {
        this.logger.error({ err: error, job: name }, 'Billing cron job failed');
      });
    });
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  async rollupUsageSnapshots(now: Date = new Date()): Promise<void> {
    const totals =
      await this.usageRecordRepository.sumOpenPeriodsGroupedByOrganizationAndFeature(now);
    for (const total of totals) {
      await this.usageRecordRepository.upsertSnapshot({
        organizationId: total.organizationId,
        featureKey: total.featureKey,
        periodStart: total.periodStart,
        periodEnd: total.periodEnd,
        totalQuantity: total.totalQuantity,
      });
    }
    this.logger.log({ snapshotCount: totals.length }, 'Completed nightly usage snapshot rollup');
  }

  async sweepExpiredTrials(now: Date = new Date()): Promise<void> {
    const expiredTrials = await this.subscriptionService.findExpiredTrials(now);
    for (const subscription of expiredTrials) {
      try {
        const hasPaymentMethod = await this.paymentMethodRepository.existsForOrganization(
          subscription.organizationId,
        );

        if (hasPaymentMethod) {
          // A real Stripe subscription (via Checkout or the Customer
          // Portal) already governs status transitions from here via
          // webhooks — the local row just needs to stop reading as
          // "trialing" once the trial window has genuinely elapsed.
          await this.subscriptionRepository.update(subscription.id, { status: 'ACTIVE' });
          await this.subscriptionRepository.recordChange({
            subscriptionId: subscription.id,
            fromPlanId: subscription.planId,
            toPlanId: subscription.planId,
            changeType: 'TRIAL_END',
            effectiveAt: now,
            metadata: { outcome: 'converted', reason: 'payment_method_on_file' },
          });
          continue;
        }

        const freePlan = await this.planService.getPlanByKeyOrThrow('free');
        await this.subscriptionRepository.update(subscription.id, {
          planId: freePlan.id,
          status: 'ACTIVE',
        });
        await this.subscriptionRepository.recordChange({
          subscriptionId: subscription.id,
          fromPlanId: subscription.planId,
          toPlanId: freePlan.id,
          changeType: 'TRIAL_END',
          effectiveAt: now,
          metadata: { outcome: 'downgraded_to_free', reason: 'no_payment_method_on_file' },
        });
      } catch (error) {
        this.logger.error(
          { err: error, subscriptionId: subscription.id },
          'Failed to sweep expired trial subscription',
        );
      }
    }
  }
}
