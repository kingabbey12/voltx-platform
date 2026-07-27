import { SchedulerRegistry } from '@nestjs/schedule';
import { BillingCronService } from '../src/modules/billing/billing-cron.service';
import { UsageRecordRepository } from '../src/modules/billing/usage-record.repository';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';
import { SubscriptionService } from '../src/modules/billing/subscription.service';
import { PlanService } from '../src/modules/billing/plan.service';
import { PaymentMethodRepository } from '../src/modules/billing/payment-method.repository';
import { InProcessDistributedLockService } from '../src/common/scheduling/distributed-lock.service';

describe('BillingCronService', () => {
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;
  let usageRecordRepository: jest.Mocked<UsageRecordRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let planService: jest.Mocked<PlanService>;
  let paymentMethodRepository: jest.Mocked<PaymentMethodRepository>;
  let service: BillingCronService;

  /** registerJob calls job.start() itself, so every job a test registers keeps a
   *  live timer that would otherwise hold the Jest worker open after the run. */
  const stopRegisteredJobs = (registry: jest.Mocked<SchedulerRegistry>): void => {
    for (const [, job] of registry.addCronJob.mock.calls) {
      (job as unknown as { stop: () => void }).stop();
    }
  };

  beforeEach(() => {
    schedulerRegistry = {
      doesExist: jest.fn().mockReturnValue(false),
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
    } as never;
    usageRecordRepository = {
      sumOpenPeriodsGroupedByOrganizationAndFeature: jest.fn().mockResolvedValue([]),
      upsertSnapshot: jest.fn(),
    } as never;
    subscriptionRepository = {
      update: jest.fn(),
      recordChange: jest.fn(),
    } as never;
    subscriptionService = {
      findExpiredTrials: jest.fn().mockResolvedValue([]),
    } as never;
    planService = {
      getPlanByKeyOrThrow: jest.fn(),
    } as never;
    paymentMethodRepository = {
      existsForOrganization: jest.fn(),
    } as never;

    service = new BillingCronService(
      schedulerRegistry,
      usageRecordRepository,
      subscriptionRepository,
      subscriptionService,
      planService,
      paymentMethodRepository,
      new InProcessDistributedLockService(),
    );
  });

  afterEach(() => {
    stopRegisteredJobs(schedulerRegistry);
  });

  describe('onModuleInit', () => {
    it('registers both cron jobs', () => {
      service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'billing-usage-snapshot-nightly',
        expect.anything(),
      );
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'billing-trial-expiry-hourly',
        expect.anything(),
      );
    });

    // Every replica registers these jobs and wakes on the same tick. Both
    // sweeps write SubscriptionChange history, so a tick that executes twice
    // duplicates a customer's billing record — hence the shared-lock guard.
    it('runs a cron tick once even when several replicas fire it', async () => {
      const sharedLock = new InProcessDistributedLockService();
      const replicas = [0, 1].map(() => {
        const registry = {
          doesExist: jest.fn().mockReturnValue(false),
          addCronJob: jest.fn(),
          deleteCronJob: jest.fn(),
        } as never as jest.Mocked<SchedulerRegistry>;
        const replica = new BillingCronService(
          registry,
          usageRecordRepository,
          subscriptionRepository,
          subscriptionService,
          planService,
          paymentMethodRepository,
          sharedLock,
        );
        replica.onModuleInit();
        return registry;
      });

      const nightlyJobs = replicas.map(
        (registry) =>
          registry.addCronJob.mock.calls.find(
            ([name]) => name === 'billing-usage-snapshot-nightly',
          )?.[1] as { fireOnTick: () => Promise<void> },
      );

      jest.useFakeTimers({ now: new Date('2026-02-01T02:00:00.000Z') });
      try {
        for (const job of nightlyJobs) {
          await job.fireOnTick();
        }
      } finally {
        jest.useRealTimers();
        replicas.forEach(stopRegisteredJobs);
      }

      expect(
        usageRecordRepository.sumOpenPeriodsGroupedByOrganizationAndFeature,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollupUsageSnapshots', () => {
    it('upserts a snapshot for every open-period usage total', async () => {
      const now = new Date('2026-02-01T02:00:00.000Z');
      usageRecordRepository.sumOpenPeriodsGroupedByOrganizationAndFeature.mockResolvedValue([
        {
          organizationId: 'org-1',
          featureKey: 'ai_requests',
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-02-01T00:00:00.000Z'),
          totalQuantity: 120,
        },
      ]);

      await service.rollupUsageSnapshots(now);

      expect(usageRecordRepository.upsertSnapshot).toHaveBeenCalledWith({
        organizationId: 'org-1',
        featureKey: 'ai_requests',
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T00:00:00.000Z'),
        totalQuantity: 120,
      });
    });
  });

  describe('sweepExpiredTrials', () => {
    it('marks an expired trial ACTIVE without changing plan when a payment method is on file', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z');
      subscriptionService.findExpiredTrials.mockResolvedValue([
        { id: 'sub-1', organizationId: 'org-1', planId: 'plan-professional' } as never,
      ]);
      paymentMethodRepository.existsForOrganization.mockResolvedValue(true);

      await service.sweepExpiredTrials(now);

      expect(subscriptionRepository.update).toHaveBeenCalledWith('sub-1', { status: 'ACTIVE' });
      expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub-1',
          changeType: 'TRIAL_END',
        }),
      );
      const recordedChange = subscriptionRepository.recordChange.mock.calls[0][0];
      expect(recordedChange.metadata).toMatchObject({ outcome: 'converted' });
      expect(planService.getPlanByKeyOrThrow).not.toHaveBeenCalled();
    });

    it('downgrades an expired trial to the Free plan when no payment method is on file', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z');
      subscriptionService.findExpiredTrials.mockResolvedValue([
        { id: 'sub-1', organizationId: 'org-1', planId: 'plan-professional' } as never,
      ]);
      paymentMethodRepository.existsForOrganization.mockResolvedValue(false);
      planService.getPlanByKeyOrThrow.mockResolvedValue({ id: 'plan-free', key: 'free' } as never);

      await service.sweepExpiredTrials(now);

      expect(planService.getPlanByKeyOrThrow).toHaveBeenCalledWith('free');
      expect(subscriptionRepository.update).toHaveBeenCalledWith('sub-1', {
        planId: 'plan-free',
        status: 'ACTIVE',
      });
      expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub-1',
          toPlanId: 'plan-free',
          changeType: 'TRIAL_END',
        }),
      );
      const recordedChange = subscriptionRepository.recordChange.mock.calls[0][0];
      expect(recordedChange.metadata).toMatchObject({ outcome: 'downgraded_to_free' });
    });

    it('continues sweeping remaining subscriptions when one fails', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z');
      subscriptionService.findExpiredTrials.mockResolvedValue([
        { id: 'sub-1', organizationId: 'org-1', planId: 'plan-professional' } as never,
        { id: 'sub-2', organizationId: 'org-2', planId: 'plan-professional' } as never,
      ]);
      paymentMethodRepository.existsForOrganization
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce(true);

      await service.sweepExpiredTrials(now);

      expect(subscriptionRepository.update).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.update).toHaveBeenCalledWith('sub-2', { status: 'ACTIVE' });
    });
  });
});
