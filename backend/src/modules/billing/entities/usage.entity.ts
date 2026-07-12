export interface UsageRecordEntity {
  id: string;
  organizationId: string;
  featureKey: string;
  quantity: number;
  metadata: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
  recordedAt: Date;
}

export interface UsageSnapshotEntity {
  id: string;
  organizationId: string;
  featureKey: string;
  periodStart: Date;
  periodEnd: Date;
  totalQuantity: number;
  computedAt: Date;
}
