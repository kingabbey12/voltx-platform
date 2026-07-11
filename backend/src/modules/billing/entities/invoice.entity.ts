export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';

export interface InvoiceEntity {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripeInvoiceId: string | null;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItemEntity {
  id: string;
  invoiceId: string;
  featureId: string | null;
  description: string;
  amount: number;
  quantity: number;
  createdAt: Date;
}
