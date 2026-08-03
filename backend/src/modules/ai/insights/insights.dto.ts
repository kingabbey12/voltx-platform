import { ExecutiveInsightsResult } from './insights.types';
export class ExecutiveInsightsResponseDto implements ExecutiveInsightsResult {
  insightVersion!: '1.0';
  generatedAt!: string;
  tenantId!: string;
  userId!: string;
  insights!: ExecutiveInsightsResult['insights'];
  excludedSources!: ExecutiveInsightsResult['excludedSources'];
  trends!: ExecutiveInsightsResult['trends'];
}
