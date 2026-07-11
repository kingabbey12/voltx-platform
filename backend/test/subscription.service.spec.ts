import { NotFoundException } from '@nestjs/common';
import { SubscriptionService } from '../src/modules/billing/subscription.service';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';
import { AuditService } from '../src/modules/audit/audit.service';
import { PlanEntity } from '../src/modules/billing/entities/plan.entity';

describe('SubscriptionService', () => {
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let auditService: jest.Mocked<AuditService>;
  let service: SubscriptionService;

  const plan: PlanEntity = {
    id: 'plan-1',
    key: 'professional',
    name: 'Professional',
    description: null,
    stripeProductId: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    isActive: true,
    sortOrder: 2,
    trialDays: 14,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    subscriptionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findCurrentForOrganization: jest.fn(),
      findCurrentForCurrentOrganization: jest.fn(),
      findByStripeSubscriptionId: jest.fn(),
      findExpiredTrials: jest.fn(),
      update: jest.fn(),
      recordChange: jest.fn(),
      listChanges: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    service = new SubscriptionService(subscriptionRepository, auditService);
  });

  it('creates a trial subscription with a trialEnd computed from the plan trialDays', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const created = { id: 'sub-1', status: 'TRIALING' } as never;
    subscriptionRepository.create.mockResolvedValue(created);

    const result = await service.createTrialSubscription(
      'org-1',
      'billing-account-1',
      plan,
      'user-1',
    );

    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        billingAccountId: 'billing-account-1',
        planId: 'plan-1',
        status: 'TRIALING',
        seats: 1,
        trialEnd: new Date('2026-01-15T00:00:00.000Z'),
      }),
    );
    expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        toPlanId: 'plan-1',
        changeType: 'TRIAL_START',
        initiatedBy: 'user-1',
      }),
    );
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'subscription.trial_start',
        resourceId: 'sub-1',
      }),
    );
    expect(result).toBe(created);

    jest.useRealTimers();
  });

  it('throws NotFoundException when no subscription exists for the organization', async () => {
    subscriptionRepository.findCurrentForOrganization.mockResolvedValue(null);

    await expect(service.getCurrentForOrganizationOrThrow('org-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns expired trials as-is', async () => {
    const now = new Date('2026-02-01');
    subscriptionRepository.findExpiredTrials.mockResolvedValue([{ id: 'sub-1' } as never]);

    const result = await service.findExpiredTrials(now);

    expect(subscriptionRepository.findExpiredTrials).toHaveBeenCalledWith(now);
    expect(result).toHaveLength(1);
  });
});
