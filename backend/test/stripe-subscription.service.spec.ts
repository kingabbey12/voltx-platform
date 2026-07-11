import { BadRequestException } from '@nestjs/common';
import {
  StripeSubscriptionService,
  mapStripeStatus,
} from '../src/modules/billing/stripe/stripe-subscription.service';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { BillingAccountService } from '../src/modules/billing/billing-account.service';
import { PlanService } from '../src/modules/billing/plan.service';
import { SubscriptionRepository } from '../src/modules/billing/subscription.repository';
import { AuditService } from '../src/modules/audit/audit.service';

describe('mapStripeStatus', () => {
  it.each([
    ['trialing', 'TRIALING'],
    ['active', 'ACTIVE'],
    ['past_due', 'PAST_DUE'],
    ['canceled', 'CANCELED'],
    ['incomplete_expired', 'CANCELED'],
    ['incomplete', 'INCOMPLETE'],
    ['unpaid', 'UNPAID'],
    ['paused', 'PAUSED'],
  ])('maps Stripe status %s to %s', (stripeStatus, expected) => {
    expect(mapStripeStatus(stripeStatus)).toBe(expected);
  });
});

describe('StripeSubscriptionService', () => {
  let stripeClientService: jest.Mocked<StripeClientService>;
  let billingAccountService: jest.Mocked<BillingAccountService>;
  let planService: jest.Mocked<PlanService>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let auditService: jest.Mocked<AuditService>;
  let service: StripeSubscriptionService;

  const currentSubscription = {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-starter',
    stripeSubscriptionId: 'sub_stripe_1',
    status: 'ACTIVE',
    seats: 1,
  };

  beforeEach(() => {
    stripeClientService = {
      client: {
        subscriptions: {
          retrieve: jest.fn(),
          update: jest.fn(),
          cancel: jest.fn(),
        },
      },
    } as never;
    billingAccountService = {
      getByOrganizationIdOrThrow: jest.fn().mockResolvedValue({ id: 'ba-1' }),
    } as never;
    planService = {
      getPlanByIdOrThrow: jest.fn(),
      getPlanByKeyOrThrow: jest.fn(),
    } as never;
    subscriptionRepository = {
      findCurrentForOrganization: jest.fn().mockResolvedValue(currentSubscription),
      update: jest.fn(),
      recordChange: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;

    service = new StripeSubscriptionService(
      stripeClientService,
      billingAccountService,
      planService,
      subscriptionRepository,
      auditService,
    );
  });

  describe('changePlan', () => {
    it('rejects a target plan with no Stripe price configured', async () => {
      planService.getPlanByIdOrThrow.mockResolvedValue({
        id: 'plan-starter',
        sortOrder: 1,
      } as never);
      planService.getPlanByKeyOrThrow.mockResolvedValue({
        id: 'plan-business',
        sortOrder: 3,
        stripePriceIdMonthly: null,
      } as never);

      await expect(service.changePlan('org-1', 'business', 5, 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when the organization has no Stripe-backed subscription yet', async () => {
      subscriptionRepository.findCurrentForOrganization.mockResolvedValue({
        ...currentSubscription,
        stripeSubscriptionId: null,
      } as never);

      await expect(service.changePlan('org-1', 'business', 5, 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates the Stripe subscription item with proration and records an UPGRADE change', async () => {
      planService.getPlanByIdOrThrow.mockResolvedValue({
        id: 'plan-starter',
        sortOrder: 1,
      } as never);
      planService.getPlanByKeyOrThrow.mockResolvedValue({
        id: 'plan-business',
        key: 'business',
        sortOrder: 3,
        stripePriceIdMonthly: 'price_business',
      } as never);
      (stripeClientService.client.subscriptions.retrieve as jest.Mock).mockResolvedValue({
        items: { data: [{ id: 'si_1' }] },
      });
      (stripeClientService.client.subscriptions.update as jest.Mock).mockResolvedValue({
        status: 'active',
        items: { data: [{ current_period_start: 1893456000, current_period_end: 1896134400 }] },
      });
      subscriptionRepository.update.mockResolvedValue({
        ...currentSubscription,
        planId: 'plan-business',
      } as never);

      await service.changePlan('org-1', 'business', 5, 'user-1');

      expect(stripeClientService.client.subscriptions.update).toHaveBeenCalledWith(
        'sub_stripe_1',
        expect.objectContaining({
          items: [{ id: 'si_1', price: 'price_business', quantity: 5 }],
          proration_behavior: 'create_prorations',
        }),
      );
      expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'UPGRADE', toPlanId: 'plan-business' }),
      );
    });
  });

  describe('cancel', () => {
    it('cancels at period end by default', async () => {
      (stripeClientService.client.subscriptions.update as jest.Mock).mockResolvedValue({
        status: 'active',
        cancel_at_period_end: true,
        canceled_at: null,
      });
      subscriptionRepository.update.mockResolvedValue(currentSubscription as never);

      await service.cancel('org-1', true, 'user-1');

      expect(stripeClientService.client.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
        cancel_at_period_end: true,
      });
      expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'CANCEL' }),
      );
    });

    it('cancels immediately when atPeriodEnd is false', async () => {
      (stripeClientService.client.subscriptions.cancel as jest.Mock).mockResolvedValue({
        status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: 1893456000,
      });
      subscriptionRepository.update.mockResolvedValue(currentSubscription as never);

      await service.cancel('org-1', false, 'user-1');

      expect(stripeClientService.client.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1');
    });
  });

  describe('resume', () => {
    it('clears cancel_at_period_end', async () => {
      (stripeClientService.client.subscriptions.update as jest.Mock).mockResolvedValue({
        status: 'active',
      });
      subscriptionRepository.update.mockResolvedValue(currentSubscription as never);

      await service.resume('org-1', 'user-1');

      expect(stripeClientService.client.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
        cancel_at_period_end: false,
      });
      expect(subscriptionRepository.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'RESUME' }),
      );
    });
  });
});
