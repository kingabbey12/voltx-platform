import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { DeveloperConnectService } from './developer-connect.service';
import { MarketplaceInstallService } from './marketplace-install.service';

/**
 * Routes Marketplace Stripe events by type — mirrors
 * StripeWebhookDispatcherService's (Billing) event-routing shape, but
 * kept as its own service/endpoint per the deliberate one-way
 * Marketplace-depends-on-Billing (never the reverse) dependency
 * direction: this dispatcher depends on Billing's StripeClientService,
 * but nothing in Billing knows the Marketplace exists.
 */
@Injectable()
export class MarketplaceStripeWebhookDispatcherService {
  private readonly logger = new Logger(MarketplaceStripeWebhookDispatcherService.name);

  constructor(
    private readonly installService: MarketplaceInstallService,
    private readonly developerConnectService: DeveloperConnectService,
  ) {}

  async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.installService.confirmPaidInstall(event.data.object);
        return;
      case 'account.updated':
        await this.developerConnectService.syncFromStripeAccount(event.data.object);
        return;
      default:
        this.logger.debug(`Ignoring unhandled marketplace Stripe event type: ${event.type}`);
    }
  }
}
