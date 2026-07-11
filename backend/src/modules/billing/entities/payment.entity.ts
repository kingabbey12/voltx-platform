export type PaymentStatus = 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentMethodType = 'CARD' | 'BANK' | 'OTHER';

export interface PaymentEntity {
  id: string;
  organizationId: string;
  invoiceId: string | null;
  paymentMethodId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failureCode: string | null;
  failureMessage: string | null;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethodEntity {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
