import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { BillingModule } from '../billing/billing.module';
import { ExtensionsModule } from '../extensions/extensions.module';
import { UsersModule } from '../users/users.module';
import { DeveloperConnectController } from './developer-connect.controller';
import { DeveloperConnectAccountRepository } from './developer-connect-account.repository';
import { DeveloperConnectService } from './developer-connect.service';
import { MarketplaceAppController } from './marketplace-app.controller';
import { MarketplaceAppExtensionController } from './marketplace-app-extension.controller';
import { MarketplaceAppExtensionService } from './marketplace-app-extension.service';
import { MarketplaceAppRepository } from './marketplace-app.repository';
import { MarketplaceAppService } from './marketplace-app.service';
import { MarketplaceInstallController } from './marketplace-install.controller';
import { MarketplaceInstallRepository } from './marketplace-install.repository';
import { MarketplaceInstallService } from './marketplace-install.service';
import { MarketplacePublicController } from './marketplace-public.controller';
import { MarketplacePublicService } from './marketplace-public.service';
import { MarketplaceReviewController } from './marketplace-review.controller';
import { MarketplaceReviewRepository } from './marketplace-review.repository';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceRevenueShareRepository } from './marketplace-revenue-share.repository';
import { MarketplaceStripeWebhookController } from './marketplace-stripe-webhook.controller';
import { MarketplaceStripeWebhookDispatcherService } from './marketplace-stripe-webhook-dispatcher.service';
import { MarketplaceVersionReviewController } from './marketplace-version-review.controller';
import { MarketplaceVersionReviewService } from './marketplace-version-review.service';

/**
 * v2.3 Developer Platform (Phase 7) — Marketplace + Stripe Connect
 * revenue sharing. Depends on BillingModule for StripeClientService
 * (the single shared Stripe SDK instance) — a strictly one-way
 * dependency; nothing in BillingModule references Marketplace.
 */
@Module({
  imports: [BillingModule, UsersModule, ExtensionsModule],
  controllers: [
    MarketplaceAppController,
    MarketplaceAppExtensionController,
    MarketplaceVersionReviewController,
    MarketplacePublicController,
    MarketplaceInstallController,
    MarketplaceReviewController,
    DeveloperConnectController,
    MarketplaceStripeWebhookController,
  ],
  providers: [
    MarketplaceAppRepository,
    MarketplaceInstallRepository,
    MarketplaceReviewRepository,
    DeveloperConnectAccountRepository,
    MarketplaceRevenueShareRepository,
    MarketplaceAppService,
    MarketplaceAppExtensionService,
    MarketplaceVersionReviewService,
    MarketplacePublicService,
    MarketplaceInstallService,
    MarketplaceReviewService,
    DeveloperConnectService,
    MarketplaceStripeWebhookDispatcherService,
    PlatformAdminGuard,
  ],
})
export class MarketplaceModule {}
