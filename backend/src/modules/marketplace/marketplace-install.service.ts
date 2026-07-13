import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAppStatus, MarketplaceInstallStatus } from '@prisma/client';
import Stripe from 'stripe';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { StripeClientService } from '../billing/stripe/stripe-client.service';
import { DeveloperConnectAccountRepository } from './developer-connect-account.repository';
import {
  InstallAppResultDto,
  InstallMarketplaceAppDto,
  MarketplaceInstallResponseDto,
} from './dto/marketplace-install.dto';
import { MarketplaceAppRepository } from './marketplace-app.repository';
import { MarketplaceInstallRepository } from './marketplace-install.repository';
import { MarketplaceRevenueShareRepository } from './marketplace-revenue-share.repository';

/** Metadata keys stashed on the Stripe Checkout Session at creation time —
 * read back by the webhook to resolve which install to create/reactivate.
 * These are set by this service alone (never client input), so they're
 * trustworthy at webhook time, but every money figure is still
 * recomputed from the version's own `priceCents` rather than carried
 * through metadata, per the platform's server-computed-revenue rule. */
const META_APP_ID = 'voltxMarketplaceAppId';
const META_VERSION_ID = 'voltxMarketplaceVersionId';
const META_INSTALLING_ORG_ID = 'voltxInstallingOrganizationId';
const META_INSTALLED_BY_USER_ID = 'voltxInstalledByUserId';

@Injectable()
export class MarketplaceInstallService {
  constructor(
    private readonly installRepository: MarketplaceInstallRepository,
    private readonly appRepository: MarketplaceAppRepository,
    private readonly connectAccountRepository: DeveloperConnectAccountRepository,
    private readonly revenueShareRepository: MarketplaceRevenueShareRepository,
    private readonly stripeClientService: StripeClientService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async listInstalled(organizationId: string): Promise<MarketplaceInstallResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entities = await this.installRepository.listByOrganization(organizationId);
    return entities.map((entity) => MarketplaceInstallResponseDto.fromEntity(entity));
  }

  async getOrThrow(id: string, organizationId: string): Promise<MarketplaceInstallResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.installRepository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Marketplace install not found');
    }
    return MarketplaceInstallResponseDto.fromEntity(entity);
  }

  async install(
    organizationId: string,
    appId: string,
    installedByUserId: string,
    dto: InstallMarketplaceAppDto,
  ): Promise<InstallAppResultDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const app = await this.appRepository.findByIdUnscoped(appId);
    if (!app || app.status !== MarketplaceAppStatus.PUBLISHED) {
      throw new NotFoundException('Marketplace app not found');
    }

    const existing = await this.installRepository.findByAppAndOrganization(appId, organizationId);
    if (existing && existing.status === MarketplaceInstallStatus.ACTIVE) {
      throw new BadRequestException('This app is already installed');
    }

    const version = await this.appRepository.findLatestPublishedVersion(appId);
    if (!version) {
      throw new BadRequestException('This app has no published version to install');
    }

    const result = new InstallAppResultDto();

    if (version.priceCents === 0) {
      const entity = existing
        ? await this.installRepository.reactivate(existing.id, version.id, installedByUserId)
        : await this.installRepository.create({
            appId,
            installingOrganizationId: organizationId,
            installedVersionId: version.id,
            installedByUserId,
          });

      await this.auditService.record({
        action: 'marketplace_install.installed',
        resource: 'marketplace_install',
        resourceId: entity.id,
        metadata: { appId, versionId: version.id, priceCents: 0 },
      });

      result.install = MarketplaceInstallResponseDto.fromEntity(entity);
      result.checkoutUrl = null;
      return result;
    }

    if (!dto.successUrl || !dto.cancelUrl) {
      throw new BadRequestException('successUrl and cancelUrl are required to install a paid app');
    }

    const connectAccount = await this.connectAccountRepository.findByOrganizationId(
      app.developerOrganizationId,
    );
    if (!connectAccount || !connectAccount.payoutsEnabled) {
      throw new BadRequestException(
        'This app cannot accept payments yet — the developer has not completed Stripe onboarding',
      );
    }

    const platformFeeBps = this.configService.get<number>('marketplace.platformFeeBps', 2000);
    const platformFeeCents = Math.round((version.priceCents * platformFeeBps) / 10000);

    const session = await this.stripeClientService.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: version.priceCents,
            product_data: { name: app.name, description: `${app.name} v${version.version}` },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: connectAccount.stripeConnectedAccountId },
      },
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata: {
        [META_APP_ID]: appId,
        [META_VERSION_ID]: version.id,
        [META_INSTALLING_ORG_ID]: organizationId,
        [META_INSTALLED_BY_USER_ID]: installedByUserId,
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    await this.auditService.record({
      action: 'marketplace_install.checkout_started',
      resource: 'marketplace_app',
      resourceId: appId,
      metadata: { versionId: version.id, priceCents: version.priceCents },
    });

    result.install = null;
    result.checkoutUrl = session.url;
    return result;
  }

  async uninstall(id: string, organizationId: string): Promise<void> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.installRepository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Marketplace install not found');
    }
    await this.installRepository.uninstall(id);

    await this.auditService.record({
      action: 'marketplace_install.uninstalled',
      resource: 'marketplace_install',
      resourceId: id,
    });
  }

  /**
   * Called by MarketplaceStripeWebhookDispatcherService on
   * `checkout.session.completed`. Every dollar figure is recomputed here
   * from the version's own `priceCents` (immutable once submitted) and
   * the currently configured platform fee — never trusted from Stripe
   * session metadata or the session's own amount fields — so a purchase
   * can never be recorded for more or less than the app's real listed
   * price. Idempotent via MarketplaceRevenueShareRepository's unique
   * `stripeCheckoutSessionId` constraint, since Stripe may redeliver this
   * event.
   */
  async confirmPaidInstall(session: Stripe.Checkout.Session): Promise<void> {
    const appId = session.metadata?.[META_APP_ID];
    const versionId = session.metadata?.[META_VERSION_ID];
    const installingOrganizationId = session.metadata?.[META_INSTALLING_ORG_ID];
    const installedByUserId = session.metadata?.[META_INSTALLED_BY_USER_ID];

    if (!appId || !versionId || !installingOrganizationId || !installedByUserId) {
      return;
    }

    const version = await this.appRepository.findVersionByIdForApp(versionId, appId);
    if (!version) {
      return;
    }

    const platformFeeBps = this.configService.get<number>('marketplace.platformFeeBps', 2000);
    const platformFeeCents = Math.round((version.priceCents * platformFeeBps) / 10000);
    const developerPayoutCents = version.priceCents - platformFeeCents;

    const existingInstall = await this.installRepository.findByAppAndOrganization(
      appId,
      installingOrganizationId,
    );
    const install = existingInstall
      ? await this.installRepository.reactivate(existingInstall.id, versionId, installedByUserId)
      : await this.installRepository.create({
          appId,
          installingOrganizationId,
          installedVersionId: versionId,
          installedByUserId,
        });

    const { isNew } = await this.revenueShareRepository.createIfNew({
      appId,
      installId: install.id,
      purchaseAmountCents: version.priceCents,
      platformFeeCents,
      developerPayoutCents,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
    });

    if (isNew) {
      await this.auditService.recordWithExplicitActor({
        organizationId: installingOrganizationId,
        userId: installedByUserId,
        action: 'marketplace_install.purchase_confirmed',
        resource: 'marketplace_install',
        resourceId: install.id,
        metadata: { appId, versionId, purchaseAmountCents: version.priceCents, platformFeeCents },
      });
    }
  }
}
