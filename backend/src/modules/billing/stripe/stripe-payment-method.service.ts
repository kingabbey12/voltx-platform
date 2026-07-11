import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeClientService } from './stripe-client.service';
import { StripeCustomerService } from './stripe-customer.service';
import { BillingAccountService } from '../billing-account.service';
import { BillingAccountRepository } from '../billing-account.repository';
import { PaymentMethodRepository } from '../payment-method.repository';
import { PaymentMethodEntity, PaymentMethodType } from '../entities/payment.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class StripePaymentMethodService {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly stripeCustomerService: StripeCustomerService,
    private readonly billingAccountService: BillingAccountService,
    private readonly billingAccountRepository: BillingAccountRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly auditService: AuditService,
  ) {}

  /** A SetupIntent is what the web/mobile client confirms client-side (Stripe Elements / PaymentSheet) to collect a payment method without charging anything yet. */
  async createSetupIntent(organizationId: string): Promise<{ clientSecret: string }> {
    const billingAccount =
      await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const stripeCustomerId = await this.stripeCustomerService.ensureStripeCustomer(billingAccount);

    const setupIntent = await this.stripeClientService.client.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'off_session',
    });

    if (!setupIntent.client_secret) {
      throw new BadRequestException('Stripe did not return a SetupIntent client secret');
    }
    return { clientSecret: setupIntent.client_secret };
  }

  /** Called once the client has confirmed the SetupIntent — attaches the resulting PaymentMethod to the Customer and mirrors it locally. */
  async attachConfirmedPaymentMethod(
    organizationId: string,
    stripePaymentMethodId: string,
    makeDefault: boolean,
  ): Promise<PaymentMethodEntity> {
    const billingAccount =
      await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const stripeCustomerId = await this.stripeCustomerService.ensureStripeCustomer(billingAccount);

    let paymentMethod =
      await this.stripeClientService.client.paymentMethods.retrieve(stripePaymentMethodId);
    if (paymentMethod.customer !== stripeCustomerId) {
      paymentMethod = await this.stripeClientService.client.paymentMethods.attach(
        stripePaymentMethodId,
        { customer: stripeCustomerId },
      );
    }

    const existing = await this.paymentMethodRepository.findByStripePaymentMethodId(
      paymentMethod.id,
    );
    const created =
      existing ??
      (await this.paymentMethodRepository.create({
        organizationId,
        billingAccountId: billingAccount.id,
        stripePaymentMethodId: paymentMethod.id,
        type: mapPaymentMethodType(paymentMethod.type),
        brand: paymentMethod.card?.brand ?? null,
        last4: paymentMethod.card?.last4 ?? paymentMethod.us_bank_account?.last4 ?? null,
        expMonth: paymentMethod.card?.exp_month ?? null,
        expYear: paymentMethod.card?.exp_year ?? null,
      }));

    if (makeDefault) {
      await this.setDefault(organizationId, created.id);
    }

    await this.auditService.record({
      action: 'billing.payment_method.attach',
      resource: 'billing_payment_method',
      resourceId: created.id,
    });

    return created;
  }

  async setDefault(organizationId: string, paymentMethodId: string): Promise<PaymentMethodEntity> {
    const billingAccount =
      await this.billingAccountService.getByOrganizationIdOrThrow(organizationId);
    const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.organizationId !== organizationId) {
      throw new NotFoundException(`Payment method "${paymentMethodId}" not found`);
    }

    const stripeCustomerId = await this.stripeCustomerService.ensureStripeCustomer(billingAccount);
    await this.stripeClientService.client.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethod.stripePaymentMethodId },
    });

    await this.billingAccountRepository.setDefaultPaymentMethod(
      billingAccount.id,
      paymentMethod.id,
    );
    const updated = await this.paymentMethodRepository.setDefault(
      billingAccount.id,
      paymentMethod.id,
    );

    await this.auditService.record({
      action: 'billing.payment_method.set_default',
      resource: 'billing_payment_method',
      resourceId: paymentMethod.id,
    });

    return updated;
  }

  async remove(organizationId: string, paymentMethodId: string): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.organizationId !== organizationId) {
      throw new NotFoundException(`Payment method "${paymentMethodId}" not found`);
    }

    await this.stripeClientService.client.paymentMethods.detach(
      paymentMethod.stripePaymentMethodId,
    );
    await this.paymentMethodRepository.remove(paymentMethod.id);

    await this.auditService.record({
      action: 'billing.payment_method.remove',
      resource: 'billing_payment_method',
      resourceId: paymentMethodId,
    });
  }
}

export function mapPaymentMethodType(type: Stripe.PaymentMethod.Type): PaymentMethodType {
  if (type === 'card') return 'CARD';
  if (type === 'us_bank_account' || type === 'sepa_debit' || type === 'acss_debit') return 'BANK';
  return 'OTHER';
}
