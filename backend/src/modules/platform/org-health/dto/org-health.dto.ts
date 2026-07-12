export class OrgHealthSignalDto {
  name!: string;
  healthy!: boolean;
  detail!: string;
  scorePenalty!: number;
}

export class OrgHealthScoreDto {
  organizationId!: string;
  score!: number;
  signals!: OrgHealthSignalDto[];
}

export class OrgDiagnosticsDto {
  organizationId!: string;
  subscriptionStatus!: string | null;
  memberCount!: number;
  recentJobFailureCount!: number;
  commsDelivery!: { totalMessages: number; failedMessages: number; failureRate: number };
  recentAuditActivityCount!: number;
}
