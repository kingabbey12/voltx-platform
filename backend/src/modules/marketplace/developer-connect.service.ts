import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeveloperConnectOnboardingStatus } from '@prisma/client';
import Stripe from 'stripe';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { StripeClientService } from '../billing/stripe/stripe-client.service';
import { DeveloperConnectAccountRepository } from './developer-connect-account.repository';
import {
  DeveloperConnectStatusResponseDto,
  OnboardingLinkResponseDto,
} from './dto/developer-connect.dto';

/**
 * Real Stripe Connect Express accounts for marketplace developers —
 * mirrors StripeCheckoutService's `client.checkout.sessions.create()`
 * pattern for talking to Stripe directly through StripeClientService,
 * plus persisting only the connected account id locally (all onboarding
 * state itself lives in Stripe, synced back via account.updated webhooks
 * — see MarketplaceStripeWebhookDispatcherService).
 */
@Injectable()
export class DeveloperConnectService {
  constructor(
    private readonly repository: DeveloperConnectAccountRepository,
    private readonly stripeClientService: StripeClientService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async createOnboardingLink(organizationId: string): Promise<OnboardingLinkResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    let account = await this.repository.findByOrganizationId(organizationId);
    if (!account) {
      const stripeAccount = await this.stripeClientService.client.accounts.create({
        type: 'express',
        metadata: { organizationId },
      });
      account = await this.repository.create(organizationId, stripeAccount.id);

      await this.auditService.record({
        action: 'developer_connect_account.created',
        resource: 'developer_connect_account',
        resourceId: account.id,
        metadata: { stripeConnectedAccountId: stripeAccount.id },
      });
    }

    const returnBaseUrl = this.configService.get<string>(
      'marketplace.connectReturnBaseUrl',
      'https://app.voltx.example/developers/connect',
    );

    const accountLink = await this.stripeClientService.client.accountLinks.create({
      account: account.stripeConnectedAccountId,
      type: 'account_onboarding',
      refresh_url: `${returnBaseUrl}?status=refresh`,
      return_url: `${returnBaseUrl}?status=complete`,
    });

    const dto = new OnboardingLinkResponseDto();
    dto.url = accountLink.url;
    return dto;
  }

  async getStatus(organizationId: string): Promise<DeveloperConnectStatusResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const account = await this.repository.findByOrganizationId(organizationId);
    const dto = new DeveloperConnectStatusResponseDto();
    dto.onboardingStatus = account?.onboardingStatus ?? DeveloperConnectOnboardingStatus.PENDING;
    dto.payoutsEnabled = account?.payoutsEnabled ?? false;
    return dto;
  }

  /** Called by MarketplaceStripeWebhookDispatcherService on
   * `account.updated` — syncs the two fields that matter for the
   * marketplace (whether the account can actually receive payouts) from
   * Stripe's own account object, the source of truth for onboarding
   * progress. A webhook for an account we don't recognize is a no-op
   * (it isn't one of ours). */
  async syncFromStripeAccount(account: Stripe.Account): Promise<void> {
    const existing = await this.repository.findByStripeConnectedAccountId(account.id);
    if (!existing) {
      return;
    }

    const onboardingStatus = account.details_submitted
      ? DeveloperConnectOnboardingStatus.COMPLETE
      : DeveloperConnectOnboardingStatus.ONBOARDING;

    await this.repository.updateStatus(
      existing.id,
      onboardingStatus,
      Boolean(account.payouts_enabled),
    );
  }
}
