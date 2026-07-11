export interface BillingEventEntity {
  id: string;
  stripeEventId: string;
  type: string;
  organizationId: string | null;
  payload: Record<string, unknown>;
  processedAt: Date | null;
  processingError: string | null;
  receivedAt: Date;
}
