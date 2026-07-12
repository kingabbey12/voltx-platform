import { QuotaService } from '../src/modules/billing/quota.service';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';
import { PlanService } from '../src/modules/billing/plan.service';
import { UsageMeteringService } from '../src/modules/billing/usage-metering.service';
import { SeatAssignmentService } from '../src/modules/billing/seat-assignment.service';

describe('QuotaService', () => {
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planService: jest.Mocked<PlanService>;
  let usageMeteringService: jest.Mocked<UsageMeteringService>;
  let seatAssignmentService: jest.Mocked<SeatAssignmentService>;
  let service: QuotaService;

  const activeSubscription = {
    id: 'sub-1',
    planId: 'plan-professional',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    subscriptionRepository = {
      findCurrentForOrganization: jest.fn().mockResolvedValue(activeSubscription),
    } as never;
    planService = {
      getPlanWithLimitsOrThrow: jest.fn(),
    } as never;
    usageMeteringService = {
      getCurrentPeriodUsage: jest.fn(),
    } as never;
    seatAssignmentService = {
      getAvailability: jest.fn(),
    } as never;

    service = new QuotaService(
      subscriptionRepository,
      planService,
      usageMeteringService,
      seatAssignmentService,
    );
  });

  it('fails open when the organization has no subscription row at all (pre-billing/legacy org)', async () => {
    subscriptionRepository.findCurrentForOrganization.mockResolvedValue(null);

    const result = await service.checkQuota('org-1', 'ai_requests', 1);

    expect(result).toEqual({
      allowed: true,
      featureKey: 'ai_requests',
      limit: null,
      currentUsage: 0,
      remaining: null,
    });
  });

  it.each(['PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED', 'INCOMPLETE'])(
    'denies with SUBSCRIPTION_INACTIVE when status is %s',
    async (status) => {
      subscriptionRepository.findCurrentForOrganization.mockResolvedValue({
        ...activeSubscription,
        status,
      } as never);

      const result = await service.checkQuota('org-1', 'ai_requests', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SUBSCRIPTION_INACTIVE');
    },
  );

  it.each(['TRIALING', 'ACTIVE'])('allows metered checks when status is %s', async (status) => {
    subscriptionRepository.findCurrentForOrganization.mockResolvedValue({
      ...activeSubscription,
      status,
    } as never);
    planService.getPlanWithLimitsOrThrow.mockResolvedValue({
      limits: [{ featureKey: 'ai_requests', unit: 'COUNT', limit: 100, softLimitPercent: null }],
    } as never);
    usageMeteringService.getCurrentPeriodUsage.mockResolvedValue(10);

    const result = await service.checkQuota('org-1', 'ai_requests', 1);

    expect(result.allowed).toBe(true);
  });

  describe('metered features', () => {
    it('allows a request within the plan limit', async () => {
      planService.getPlanWithLimitsOrThrow.mockResolvedValue({
        limits: [{ featureKey: 'ai_requests', unit: 'COUNT', limit: 100, softLimitPercent: null }],
      } as never);
      usageMeteringService.getCurrentPeriodUsage.mockResolvedValue(50);

      const result = await service.checkQuota('org-1', 'ai_requests', 1);

      expect(result).toEqual({
        allowed: true,
        featureKey: 'ai_requests',
        limit: 100,
        currentUsage: 50,
        remaining: 50,
      });
    });

    it('denies a request that would exceed the plan limit', async () => {
      planService.getPlanWithLimitsOrThrow.mockResolvedValue({
        limits: [{ featureKey: 'ai_requests', unit: 'COUNT', limit: 100, softLimitPercent: null }],
      } as never);
      usageMeteringService.getCurrentPeriodUsage.mockResolvedValue(100);

      const result = await service.checkQuota('org-1', 'ai_requests', 1);

      expect(result).toEqual({
        allowed: false,
        featureKey: 'ai_requests',
        limit: 100,
        currentUsage: 100,
        remaining: 0,
        reason: 'QUOTA_EXCEEDED',
      });
    });

    it('always allows a feature with an unlimited (null) limit', async () => {
      planService.getPlanWithLimitsOrThrow.mockResolvedValue({
        limits: [{ featureKey: 'ai_requests', unit: 'COUNT', limit: null, softLimitPercent: null }],
      } as never);
      usageMeteringService.getCurrentPeriodUsage.mockResolvedValue(1_000_000);

      const result = await service.checkQuota('org-1', 'ai_requests', 1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeNull();
    });

    it('treats a feature with no FeatureLimit row as unlimited', async () => {
      planService.getPlanWithLimitsOrThrow.mockResolvedValue({ limits: [] } as never);
      usageMeteringService.getCurrentPeriodUsage.mockResolvedValue(5);

      const result = await service.checkQuota('org-1', 'some_untracked_feature', 1);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe('seats', () => {
    it('allows when a seat is available', async () => {
      seatAssignmentService.getAvailability.mockResolvedValue({
        used: 2,
        limit: 5,
        available: 3,
        hasCapacity: true,
      });

      const result = await service.checkQuota('org-1', 'seats', 1);

      expect(result).toEqual({
        allowed: true,
        featureKey: 'seats',
        limit: 5,
        currentUsage: 2,
        remaining: 3,
      });
      expect(planService.getPlanWithLimitsOrThrow).not.toHaveBeenCalled();
    });

    it('denies when no seat is available', async () => {
      seatAssignmentService.getAvailability.mockResolvedValue({
        used: 5,
        limit: 5,
        available: 0,
        hasCapacity: false,
      });

      const result = await service.checkQuota('org-1', 'seats', 1);

      expect(result).toEqual({
        allowed: false,
        featureKey: 'seats',
        limit: 5,
        currentUsage: 5,
        remaining: 0,
        reason: 'QUOTA_EXCEEDED',
      });
    });
  });
});
