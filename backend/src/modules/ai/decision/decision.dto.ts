import { ExecutiveDecisionsResult } from './decision.types';

export class ExecutiveDecisionsResponseDto implements ExecutiveDecisionsResult {
  decisionVersion!: '1.0';
  generatedAt!: string;
  tenantId!: string;
  userId!: string;
  decisions!: ExecutiveDecisionsResult['decisions'];
  excludedSources!: ExecutiveDecisionsResult['excludedSources'];
  insightsConsidered!: number;
  rulesEvaluated!: string[];
  priorityDistribution!: ExecutiveDecisionsResult['priorityDistribution'];
  approvalRequiredCount!: number;
}
