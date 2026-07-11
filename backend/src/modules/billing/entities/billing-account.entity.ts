export interface BillingAccountEntity {
  id: string;
  organizationId: string;
  stripeCustomerId: string | null;
  email: string | null;
  defaultPaymentMethodId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
