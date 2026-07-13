import { MarketplaceStripeWebhookDispatcherService } from '../src/modules/marketplace/marketplace-stripe-webhook-dispatcher.service';
import { MarketplaceInstallService } from '../src/modules/marketplace/marketplace-install.service';
import { DeveloperConnectService } from '../src/modules/marketplace/developer-connect.service';

describe('MarketplaceStripeWebhookDispatcherService', () => {
  let installService: jest.Mocked<MarketplaceInstallService>;
  let developerConnectService: jest.Mocked<DeveloperConnectService>;
  let service: MarketplaceStripeWebhookDispatcherService;

  beforeEach(() => {
    installService = { confirmPaidInstall: jest.fn() } as never;
    developerConnectService = { syncFromStripeAccount: jest.fn() } as never;

    service = new MarketplaceStripeWebhookDispatcherService(
      installService,
      developerConnectService,
    );
  });

  it('routes checkout.session.completed to MarketplaceInstallService', async () => {
    const session = { id: 'cs_123' };
    await service.dispatch({
      type: 'checkout.session.completed',
      data: { object: session },
    } as never);

    expect(installService.confirmPaidInstall).toHaveBeenCalledWith(session);
    expect(developerConnectService.syncFromStripeAccount).not.toHaveBeenCalled();
  });

  it('routes account.updated to DeveloperConnectService', async () => {
    const account = { id: 'acct_123' };
    await service.dispatch({ type: 'account.updated', data: { object: account } } as never);

    expect(developerConnectService.syncFromStripeAccount).toHaveBeenCalledWith(account);
    expect(installService.confirmPaidInstall).not.toHaveBeenCalled();
  });

  it('ignores unhandled event types without throwing', async () => {
    await expect(
      service.dispatch({ type: 'charge.refunded', data: { object: {} } } as never),
    ).resolves.toBeUndefined();

    expect(installService.confirmPaidInstall).not.toHaveBeenCalled();
    expect(developerConnectService.syncFromStripeAccount).not.toHaveBeenCalled();
  });
});
