import { DeveloperConnectOnboardingStatus } from '@prisma/client';
import { DeveloperConnectService } from '../src/modules/marketplace/developer-connect.service';
import { DeveloperConnectAccountRepository } from '../src/modules/marketplace/developer-connect-account.repository';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('DeveloperConnectService', () => {
  let repository: jest.Mocked<DeveloperConnectAccountRepository>;
  let stripeClientService: jest.Mocked<StripeClientService>;
  let auditService: jest.Mocked<AuditService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let configService: { get: jest.Mock };
  let service: DeveloperConnectService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByOrganizationId: jest.fn(),
      findByStripeConnectedAccountId: jest.fn(),
      updateStatus: jest.fn(),
    } as never;
    stripeClientService = {
      client: {
        accounts: { create: jest.fn() },
        accountLinks: { create: jest.fn() },
      },
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;
    configService = {
      get: jest.fn().mockReturnValue('https://app.voltx.example/developers/connect'),
    };

    service = new DeveloperConnectService(
      repository,
      stripeClientService,
      auditService,
      tenantContextService,
      configService as never,
    );
  });

  describe('createOnboardingLink', () => {
    it('creates a new Stripe Express account on first onboarding', async () => {
      repository.findByOrganizationId.mockResolvedValue(null);
      (stripeClientService.client.accounts.create as jest.Mock).mockResolvedValue({
        id: 'acct_new',
      });
      repository.create.mockResolvedValue({
        id: 'connect-1',
        stripeConnectedAccountId: 'acct_new',
      } as never);
      (stripeClientService.client.accountLinks.create as jest.Mock).mockResolvedValue({
        url: 'https://connect.stripe.com/setup/acct_new',
      });

      const result = await service.createOnboardingLink('org-1');

      expect(stripeClientService.client.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'express' }),
      );
      expect(repository.create).toHaveBeenCalledWith('org-1', 'acct_new');
      expect(result.url).toBe('https://connect.stripe.com/setup/acct_new');
    });

    it('reuses an existing connected account rather than creating a second one', async () => {
      repository.findByOrganizationId.mockResolvedValue({
        id: 'connect-1',
        stripeConnectedAccountId: 'acct_existing',
      } as never);
      (stripeClientService.client.accountLinks.create as jest.Mock).mockResolvedValue({
        url: 'https://connect.stripe.com/setup/acct_existing',
      });

      await service.createOnboardingLink('org-1');

      expect(stripeClientService.client.accounts.create).not.toHaveBeenCalled();
      expect(stripeClientService.client.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'acct_existing' }),
      );
    });
  });

  describe('getStatus', () => {
    it('defaults to PENDING/payoutsEnabled=false when no account exists yet', async () => {
      repository.findByOrganizationId.mockResolvedValue(null);

      const result = await service.getStatus('org-1');

      expect(result.onboardingStatus).toBe(DeveloperConnectOnboardingStatus.PENDING);
      expect(result.payoutsEnabled).toBe(false);
    });
  });

  describe('syncFromStripeAccount', () => {
    it('is a no-op for an account we do not recognize', async () => {
      repository.findByStripeConnectedAccountId.mockResolvedValue(null);

      await service.syncFromStripeAccount({ id: 'acct_unknown' } as never);

      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('marks onboarding COMPLETE and payoutsEnabled true once Stripe reports both', async () => {
      repository.findByStripeConnectedAccountId.mockResolvedValue({ id: 'connect-1' } as never);

      await service.syncFromStripeAccount({
        id: 'acct_1',
        details_submitted: true,
        payouts_enabled: true,
      } as never);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'connect-1',
        DeveloperConnectOnboardingStatus.COMPLETE,
        true,
      );
    });

    it('leaves onboarding as ONBOARDING when details have not been submitted yet', async () => {
      repository.findByStripeConnectedAccountId.mockResolvedValue({ id: 'connect-1' } as never);

      await service.syncFromStripeAccount({
        id: 'acct_1',
        details_submitted: false,
        payouts_enabled: false,
      } as never);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'connect-1',
        DeveloperConnectOnboardingStatus.ONBOARDING,
        false,
      );
    });
  });
});
