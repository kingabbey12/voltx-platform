import { NotFoundException } from '@nestjs/common';
import {
  StripePaymentMethodService,
  mapPaymentMethodType,
} from '../src/modules/billing/stripe/stripe-payment-method.service';
import { StripeClientService } from '../src/modules/billing/stripe/stripe-client.service';
import { StripeCustomerService } from '../src/modules/billing/stripe/stripe-customer.service';
import { BillingAccountService } from '../src/modules/billing/billing-account.service';
import { BillingAccountRepository } from '../src/modules/billing/billing-account.repository';
import { PaymentMethodRepository } from '../src/modules/billing/payment-method.repository';
import { AuditService } from '../src/modules/audit/audit.service';

describe('mapPaymentMethodType', () => {
  it.each([
    ['card', 'CARD'],
    ['us_bank_account', 'BANK'],
    ['sepa_debit', 'BANK'],
    ['acss_debit', 'BANK'],
    ['link', 'OTHER'],
  ])('maps Stripe type %s to %s', (stripeType, expected) => {
    expect(mapPaymentMethodType(stripeType as never)).toBe(expected);
  });
});

describe('StripePaymentMethodService', () => {
  let stripeClientService: jest.Mocked<StripeClientService>;
  let stripeCustomerService: jest.Mocked<StripeCustomerService>;
  let billingAccountService: jest.Mocked<BillingAccountService>;
  let billingAccountRepository: jest.Mocked<BillingAccountRepository>;
  let paymentMethodRepository: jest.Mocked<PaymentMethodRepository>;
  let auditService: jest.Mocked<AuditService>;
  let service: StripePaymentMethodService;

  const billingAccount = { id: 'ba-1', organizationId: 'org-1' } as never;

  beforeEach(() => {
    stripeClientService = {
      client: {
        setupIntents: { create: jest.fn() },
        paymentMethods: { retrieve: jest.fn(), attach: jest.fn(), detach: jest.fn() },
        customers: { update: jest.fn() },
      },
    } as never;
    stripeCustomerService = {
      ensureStripeCustomer: jest.fn().mockResolvedValue('cus_123'),
    } as never;
    billingAccountService = {
      getByOrganizationIdOrThrow: jest.fn().mockResolvedValue(billingAccount),
    } as never;
    billingAccountRepository = { setDefaultPaymentMethod: jest.fn() } as never;
    paymentMethodRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByStripePaymentMethodId: jest.fn(),
      setDefault: jest.fn(),
      remove: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;

    service = new StripePaymentMethodService(
      stripeClientService,
      stripeCustomerService,
      billingAccountService,
      billingAccountRepository,
      paymentMethodRepository,
      auditService,
    );
  });

  describe('createSetupIntent', () => {
    it('returns the SetupIntent client secret', async () => {
      (stripeClientService.client.setupIntents.create as jest.Mock).mockResolvedValue({
        client_secret: 'seti_123_secret',
      });

      const result = await service.createSetupIntent('org-1');

      expect(result).toEqual({ clientSecret: 'seti_123_secret' });
    });
  });

  describe('attachConfirmedPaymentMethod', () => {
    it('attaches a payment method not yet on the customer and mirrors it locally', async () => {
      (stripeClientService.client.paymentMethods.retrieve as jest.Mock).mockResolvedValue({
        id: 'pm_123',
        customer: null,
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      });
      (stripeClientService.client.paymentMethods.attach as jest.Mock).mockResolvedValue({
        id: 'pm_123',
        customer: 'cus_123',
        type: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      });
      paymentMethodRepository.findByStripePaymentMethodId.mockResolvedValue(null);
      paymentMethodRepository.create.mockResolvedValue({ id: 'method-1' } as never);

      const result = await service.attachConfirmedPaymentMethod('org-1', 'pm_123', false);

      expect(stripeClientService.client.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
        customer: 'cus_123',
      });
      expect(paymentMethodRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ stripePaymentMethodId: 'pm_123', brand: 'visa', last4: '4242' }),
      );
      expect(result).toEqual({ id: 'method-1' });
    });

    it('does not re-attach a payment method already on the customer', async () => {
      (stripeClientService.client.paymentMethods.retrieve as jest.Mock).mockResolvedValue({
        id: 'pm_123',
        customer: 'cus_123',
        type: 'card',
        card: {},
      });
      paymentMethodRepository.findByStripePaymentMethodId.mockResolvedValue({
        id: 'method-1',
      } as never);

      await service.attachConfirmedPaymentMethod('org-1', 'pm_123', false);

      expect(stripeClientService.client.paymentMethods.attach).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('throws NotFoundException for a payment method belonging to another organization', async () => {
      paymentMethodRepository.findById.mockResolvedValue({
        id: 'method-1',
        organizationId: 'other-org',
      } as never);

      await expect(service.setDefault('org-1', 'method-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates the Stripe customer default and mirrors it locally', async () => {
      paymentMethodRepository.findById.mockResolvedValue({
        id: 'method-1',
        organizationId: 'org-1',
        stripePaymentMethodId: 'pm_123',
      } as never);
      paymentMethodRepository.setDefault.mockResolvedValue({
        id: 'method-1',
        isDefault: true,
      } as never);

      const result = await service.setDefault('org-1', 'method-1');

      expect(stripeClientService.client.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: { default_payment_method: 'pm_123' },
      });
      expect(billingAccountRepository.setDefaultPaymentMethod).toHaveBeenCalledWith(
        'ba-1',
        'method-1',
      );
      expect(result).toEqual({ id: 'method-1', isDefault: true });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for a payment method belonging to another organization', async () => {
      paymentMethodRepository.findById.mockResolvedValue({
        id: 'method-1',
        organizationId: 'other-org',
      } as never);

      await expect(service.remove('org-1', 'method-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('detaches from Stripe and removes the local row', async () => {
      paymentMethodRepository.findById.mockResolvedValue({
        id: 'method-1',
        organizationId: 'org-1',
        stripePaymentMethodId: 'pm_123',
      } as never);

      await service.remove('org-1', 'method-1');

      expect(stripeClientService.client.paymentMethods.detach).toHaveBeenCalledWith('pm_123');
      expect(paymentMethodRepository.remove).toHaveBeenCalledWith('method-1');
    });
  });
});
