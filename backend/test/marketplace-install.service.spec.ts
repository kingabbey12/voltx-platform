import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus, MarketplaceInstallStatus } from '@prisma/client';
import { MarketplaceInstallService } from '../src/modules/marketplace/marketplace-install.service';
import { MarketplaceInstallRepository } from '../src/modules/marketplace/marketplace-install.repository';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { DeveloperConnectAccountRepository } from '../src/modules/marketplace/developer-connect-account.repository';
import { MarketplaceRevenueShareRepository } from '../src/modules/marketplace/marketplace-revenue-share.repository';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('MarketplaceInstallService', () => {
  let installRepository: jest.Mocked<MarketplaceInstallRepository>;
  let appRepository: jest.Mocked<MarketplaceAppRepository>;
  let connectAccountRepository: jest.Mocked<DeveloperConnectAccountRepository>;
  let revenueShareRepository: jest.Mocked<MarketplaceRevenueShareRepository>;
  let stripeClientService: jest.Mocked<StripeClientService>;
  let auditService: jest.Mocked<AuditService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let configService: { get: jest.Mock };
  let service: MarketplaceInstallService;

  const app = {
    id: 'app-1',
    developerOrganizationId: 'dev-org-1',
    name: 'Acme Reporting',
    status: MarketplaceAppStatus.PUBLISHED,
  };

  const freeVersion = { id: 'version-free', appId: 'app-1', version: '1.0.0', priceCents: 0 };
  const paidVersion = { id: 'version-paid', appId: 'app-1', version: '2.0.0', priceCents: 10000 };

  beforeEach(() => {
    installRepository = {
      create: jest.fn(),
      listByOrganization: jest.fn(),
      findByIdInOrganization: jest.fn(),
      findByAppAndOrganization: jest.fn(),
      uninstall: jest.fn(),
      reactivate: jest.fn(),
    } as never;
    appRepository = {
      findByIdUnscoped: jest.fn(),
      findLatestPublishedVersion: jest.fn(),
      findVersionByIdForApp: jest.fn(),
    } as never;
    connectAccountRepository = {
      findByOrganizationId: jest.fn(),
      findByStripeConnectedAccountId: jest.fn(),
    } as never;
    revenueShareRepository = {
      createIfNew: jest.fn(),
      findByCheckoutSessionId: jest.fn(),
    } as never;
    stripeClientService = {
      client: { checkout: { sessions: { create: jest.fn() } } },
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;
    configService = { get: jest.fn().mockReturnValue(2000) };

    service = new MarketplaceInstallService(
      installRepository,
      appRepository,
      connectAccountRepository,
      revenueShareRepository,
      stripeClientService,
      auditService,
      tenantContextService,
      configService as never,
    );
  });

  describe('install', () => {
    it('enforces tenant access before doing anything else', async () => {
      tenantContextService.assertOrganizationAccess.mockImplementation(() => {
        throw new ForbiddenException('Cross-tenant access is forbidden');
      });

      await expect(service.install('org-1', 'app-1', 'user-1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(appRepository.findByIdUnscoped).not.toHaveBeenCalled();
    });

    it('404s for an app that does not exist or is not published', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(null);

      await expect(service.install('org-1', 'app-1', 'user-1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects installing an app that is already actively installed', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue({
        id: 'install-1',
        status: MarketplaceInstallStatus.ACTIVE,
      } as never);

      await expect(service.install('org-1', 'app-1', 'user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('installs a free app synchronously with no Stripe involvement', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue(null);
      appRepository.findLatestPublishedVersion.mockResolvedValue(freeVersion as never);
      installRepository.create.mockResolvedValue({
        id: 'install-1',
        appId: 'app-1',
        installedVersionId: 'version-free',
        status: MarketplaceInstallStatus.ACTIVE,
        createdAt: new Date(),
      } as never);

      const result = await service.install('org-1', 'app-1', 'user-1', {});

      expect(stripeClientService.client.checkout.sessions.create).not.toHaveBeenCalled();
      expect(result.checkoutUrl).toBeNull();
      expect(result.install).not.toBeNull();
      expect(result.install?.id).toBe('install-1');
    });

    it('reactivates a previously-uninstalled free app instead of creating a new row', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue({
        id: 'install-1',
        status: MarketplaceInstallStatus.UNINSTALLED,
      } as never);
      appRepository.findLatestPublishedVersion.mockResolvedValue(freeVersion as never);
      installRepository.reactivate.mockResolvedValue({
        id: 'install-1',
        status: MarketplaceInstallStatus.ACTIVE,
        createdAt: new Date(),
      } as never);

      await service.install('org-1', 'app-1', 'user-1', {});

      expect(installRepository.reactivate).toHaveBeenCalledWith(
        'install-1',
        'version-free',
        'user-1',
      );
      expect(installRepository.create).not.toHaveBeenCalled();
    });

    it('requires successUrl/cancelUrl for a paid app', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue(null);
      appRepository.findLatestPublishedVersion.mockResolvedValue(paidVersion as never);

      await expect(service.install('org-1', 'app-1', 'user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(stripeClientService.client.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('rejects installing a paid app whose developer has not finished Connect onboarding', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue(null);
      appRepository.findLatestPublishedVersion.mockResolvedValue(paidVersion as never);
      connectAccountRepository.findByOrganizationId.mockResolvedValue(null);

      await expect(
        service.install('org-1', 'app-1', 'user-1', {
          successUrl: 'https://a',
          cancelUrl: 'https://b',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripeClientService.client.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('creates a Stripe Checkout session with a server-computed application fee for a paid app', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(app as never);
      installRepository.findByAppAndOrganization.mockResolvedValue(null);
      appRepository.findLatestPublishedVersion.mockResolvedValue(paidVersion as never);
      connectAccountRepository.findByOrganizationId.mockResolvedValue({
        id: 'connect-1',
        stripeConnectedAccountId: 'acct_dev123',
        payoutsEnabled: true,
      } as never);
      (stripeClientService.client.checkout.sessions.create as jest.Mock).mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
      });

      const result = await service.install('org-1', 'app-1', 'user-1', {
        successUrl: 'https://app.voltx.example/success',
        cancelUrl: 'https://app.voltx.example/cancel',
      });

      expect(stripeClientService.client.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_intent_data: {
            application_fee_amount: 2000, // 20% of 10000 cents at the mocked 2000bps rate
            transfer_data: { destination: 'acct_dev123' },
          },
        }),
      );
      expect(result.install).toBeNull();
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_123');
      expect(installRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('uninstall', () => {
    it('404s for an install the organization does not own', async () => {
      installRepository.findByIdInOrganization.mockResolvedValue(null);

      await expect(service.uninstall('install-1', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(installRepository.uninstall).not.toHaveBeenCalled();
    });

    it('uninstalls an owned install', async () => {
      installRepository.findByIdInOrganization.mockResolvedValue({ id: 'install-1' } as never);

      await service.uninstall('install-1', 'org-1');

      expect(installRepository.uninstall).toHaveBeenCalledWith('install-1');
    });
  });

  describe('confirmPaidInstall', () => {
    const baseSession = {
      id: 'cs_123',
      payment_intent: 'pi_123',
      metadata: {
        voltxMarketplaceAppId: 'app-1',
        voltxMarketplaceVersionId: 'version-paid',
        voltxInstallingOrganizationId: 'org-1',
        voltxInstalledByUserId: 'user-1',
      },
    };

    it('is a no-op when metadata is missing (not one of ours)', async () => {
      await service.confirmPaidInstall({ id: 'cs_999', metadata: {} } as never);
      expect(appRepository.findVersionByIdForApp).not.toHaveBeenCalled();
    });

    it('recomputes the platform fee and developer payout from the version, never from the session', async () => {
      appRepository.findVersionByIdForApp.mockResolvedValue(paidVersion as never);
      installRepository.findByAppAndOrganization.mockResolvedValue(null);
      installRepository.create.mockResolvedValue({ id: 'install-1' } as never);
      revenueShareRepository.createIfNew.mockResolvedValue({
        entity: { id: 'share-1' } as never,
        isNew: true,
      });

      await service.confirmPaidInstall(baseSession as never);

      expect(revenueShareRepository.createIfNew).toHaveBeenCalledWith({
        appId: 'app-1',
        installId: 'install-1',
        purchaseAmountCents: 10000,
        platformFeeCents: 2000,
        developerPayoutCents: 8000,
        stripeCheckoutSessionId: 'cs_123',
        stripePaymentIntentId: 'pi_123',
      });
      expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'marketplace_install.purchase_confirmed' }),
      );
    });

    it('reactivates an existing uninstalled row instead of creating a duplicate', async () => {
      appRepository.findVersionByIdForApp.mockResolvedValue(paidVersion as never);
      installRepository.findByAppAndOrganization.mockResolvedValue({
        id: 'install-1',
        status: MarketplaceInstallStatus.UNINSTALLED,
      } as never);
      installRepository.reactivate.mockResolvedValue({ id: 'install-1' } as never);
      revenueShareRepository.createIfNew.mockResolvedValue({
        entity: { id: 'share-1' } as never,
        isNew: true,
      });

      await service.confirmPaidInstall(baseSession as never);

      expect(installRepository.reactivate).toHaveBeenCalledWith(
        'install-1',
        'version-paid',
        'user-1',
      );
      expect(installRepository.create).not.toHaveBeenCalled();
    });

    it('does not double-record revenue or re-audit on a redelivered webhook', async () => {
      appRepository.findVersionByIdForApp.mockResolvedValue(paidVersion as never);
      installRepository.findByAppAndOrganization.mockResolvedValue({
        id: 'install-1',
        status: MarketplaceInstallStatus.ACTIVE,
      } as never);
      installRepository.reactivate.mockResolvedValue({ id: 'install-1' } as never);
      revenueShareRepository.createIfNew.mockResolvedValue({
        entity: { id: 'share-1' } as never,
        isNew: false,
      });

      await service.confirmPaidInstall(baseSession as never);

      expect(auditService.recordWithExplicitActor).not.toHaveBeenCalled();
    });
  });
});
