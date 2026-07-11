import { BadRequestException } from '@nestjs/common';
import { StripeCheckoutService } from '../src/modules/billing/stripe/stripe-checkout.service';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { StripeCustomerService } from '../src/modules/billing/stripe/stripe-customer.service';
import { BillingAccountService } from '../src/modules/billing/billing-account.service';
import { PlanService } from '../src/modules/billing/plan.service';
import { SessionRepository } from '../src/modules/billing/session.repository';
import { AuditService } from '../src/modules/audit/audit.service';

describe('StripeCheckoutService', () => {
  let stripeClientService: jest.Mocked<StripeClientService>;
  let stripeCustomerService: jest.Mocked<StripeCustomerService>;
  let billingAccountService: jest.Mocked<BillingAccountService>;
  let planService: jest.Mocked<PlanService>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let auditService: jest.Mocked<AuditService>;
  let service: StripeCheckoutService;

  const billingAccount = { id: 'ba-1', organizationId: 'org-1', stripeCustomerId: null };
  const plan = {
    id: 'plan-1',
    key: 'professional',
    stripePriceIdMonthly: 'price_123',
  };

  beforeEach(() => {
    stripeClientService = {
      client: {
        checkout: { sessions: { create: jest.fn() } },
        billingPortal: { sessions: { create: jest.fn() } },
      },
    } as never;
    stripeCustomerService = {
      ensureStripeCustomer: jest.fn().mockResolvedValue('cus_123'),
    } as never;
    billingAccountService = {
      getByOrganizationIdOrThrow: jest.fn().mockResolvedValue(billingAccount),
    } as never;
    planService = { getPlanByKeyOrThrow: jest.fn().mockResolvedValue(plan) } as never;
    sessionRepository = {
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;

    service = new StripeCheckoutService(
      stripeClientService,
      stripeCustomerService,
      billingAccountService,
      planService,
      sessionRepository,
      auditService,
    );
  });

  describe('createCheckoutSession', () => {
    it('rejects a plan with no Stripe price configured', async () => {
      planService.getPlanByKeyOrThrow.mockResolvedValue({
        ...plan,
        stripePriceIdMonthly: null,
      } as never);

      await expect(
        service.createCheckoutSession('org-1', 'professional', 1, 'https://a', 'https://b'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a Stripe Checkout session using the caller-supplied success/cancel URLs', async () => {
      (stripeClientService.client.checkout.sessions.create as jest.Mock).mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
        expires_at: 1893456000,
      });
      sessionRepository.createCheckoutSession.mockResolvedValue({
        id: 'session-1',
        url: 'https://checkout.stripe.com/cs_123',
      } as never);

      const result = await service.createCheckoutSession(
        'org-1',
        'professional',
        3,
        'https://app.voltx.io/billing?checkout=success',
        'https://app.voltx.io/billing/upgrade?checkout=cancelled',
      );

      expect(stripeClientService.client.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://app.voltx.io/billing?checkout=success',
          cancel_url: 'https://app.voltx.io/billing/upgrade?checkout=cancelled',
          line_items: [{ price: 'price_123', quantity: 3 }],
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.checkout.create' }),
      );
      expect(result).toEqual({ id: 'session-1', url: 'https://checkout.stripe.com/cs_123' });
    });

    it('throws when Stripe returns no checkout URL', async () => {
      (stripeClientService.client.checkout.sessions.create as jest.Mock).mockResolvedValue({
        id: 'cs_123',
        url: null,
      });

      await expect(
        service.createCheckoutSession('org-1', 'professional', 1, 'https://a', 'https://b'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createPortalSession', () => {
    it('creates a Stripe Billing Portal session using the caller-supplied return URL', async () => {
      (stripeClientService.client.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/bps_123',
      });
      sessionRepository.createPortalSession.mockResolvedValue({
        id: 'portal-1',
        url: 'https://billing.stripe.com/bps_123',
      } as never);

      const result = await service.createPortalSession('org-1', 'https://app.voltx.io/billing');

      expect(stripeClientService.client.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ return_url: 'https://app.voltx.io/billing' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.portal.create' }),
      );
      expect(result).toEqual({ id: 'portal-1', url: 'https://billing.stripe.com/bps_123' });
    });
  });
});
