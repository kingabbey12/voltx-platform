import { UsageMeteringService } from '../src/modules/billing/usage-metering.service';
import { UsageRecordRepository } from '../src/modules/billing/usage-record.repository';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';

describe('UsageMeteringService', () => {
  let usageRecordRepository: jest.Mocked<UsageRecordRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let service: UsageMeteringService;

  const subscription = {
    id: 'sub-1',
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    usageRecordRepository = {
      create: jest.fn(),
      sumForPeriod: jest.fn(),
      sumOpenPeriodsGroupedByOrganizationAndFeature: jest.fn(),
      upsertSnapshot: jest.fn(),
      listSnapshotsForOrganization: jest.fn(),
    } as never;
    subscriptionRepository = {
      findCurrentForOrganization: jest.fn().mockResolvedValue(subscription),
    } as never;

    service = new UsageMeteringService(usageRecordRepository, subscriptionRepository);
  });

  describe('record', () => {
    it('records usage against the org current billing period', async () => {
      await service.record('org-1', 'ai_requests', 1, { model: 'gpt-5-mini' });

      expect(usageRecordRepository.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        featureKey: 'ai_requests',
        quantity: 1,
        metadata: { model: 'gpt-5-mini' },
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      });
    });

    it('never throws — logs and swallows a repository failure', async () => {
      usageRecordRepository.create.mockRejectedValue(new Error('db unavailable'));

      await expect(service.record('org-1', 'ai_requests', 1)).resolves.toBeUndefined();
    });

    it('does not write a record for a non-positive quantity', async () => {
      await service.record('org-1', 'ai_requests', 0);

      expect(usageRecordRepository.create).not.toHaveBeenCalled();
    });

    it('falls back to the current UTC calendar month when the org has no subscription row', async () => {
      subscriptionRepository.findCurrentForOrganization.mockResolvedValue(null);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-15T12:00:00.000Z'));

      await service.record('org-1', 'storage', 1024);

      expect(usageRecordRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          periodStart: new Date('2026-03-01T00:00:00.000Z'),
          periodEnd: new Date('2026-04-01T00:00:00.000Z'),
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('getCurrentPeriodUsage', () => {
    it('sums usage for the org current billing period', async () => {
      usageRecordRepository.sumForPeriod.mockResolvedValue(42);

      const result = await service.getCurrentPeriodUsage('org-1', 'ai_requests');

      expect(usageRecordRepository.sumForPeriod).toHaveBeenCalledWith(
        'org-1',
        'ai_requests',
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
      );
      expect(result).toBe(42);
    });

    it('never throws — returns 0 on failure', async () => {
      usageRecordRepository.sumForPeriod.mockRejectedValue(new Error('db unavailable'));

      const result = await service.getCurrentPeriodUsage('org-1', 'ai_requests');

      expect(result).toBe(0);
    });
  });

  describe('getUsageHistory', () => {
    it('delegates to the repository', async () => {
      usageRecordRepository.listSnapshotsForOrganization.mockResolvedValue([
        { id: 'snap-1' } as never,
      ]);

      const result = await service.getUsageHistory('org-1', 'ai_requests', 30);

      expect(usageRecordRepository.listSnapshotsForOrganization).toHaveBeenCalledWith(
        'org-1',
        'ai_requests',
        30,
      );
      expect(result).toHaveLength(1);
    });
  });
});
