import { Injectable, Logger } from '@nestjs/common';
import { StripeClientService } from './stripe-client.service';
import { BillingAccountRepository } from '../billing-account.repository';
import { BillingAccountEntity } from '../entities/billing-account.entity';

/**
 * Backfills BillingAccount.stripeCustomerId the first time an
 * organization's billing actually talks to Stripe (checkout, payment
 * method, etc.) — Phase 1 creates the local BillingAccount row at
 * registration with stripeCustomerId genuinely null; this is where it
 * gets a real Stripe Customer for the first time.
 */
@Injectable()
export class StripeCustomerService {
  private readonly logger = new Logger(StripeCustomerService.name);

  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly billingAccountRepository: BillingAccountRepository,
  ) {}

  async ensureStripeCustomer(billingAccount: BillingAccountEntity): Promise<string> {
    if (billingAccount.stripeCustomerId) {
      return billingAccount.stripeCustomerId;
    }

    const customer = await this.stripeClientService.client.customers.create({
      email: billingAccount.email ?? undefined,
      metadata: {
        organizationId: billingAccount.organizationId,
        billingAccountId: billingAccount.id,
      },
    });

    await this.billingAccountRepository.setStripeCustomerId(billingAccount.id, customer.id);
    this.logger.log(
      { organizationId: billingAccount.organizationId, stripeCustomerId: customer.id },
      'Created Stripe customer',
    );

    return customer.id;
  }
}
