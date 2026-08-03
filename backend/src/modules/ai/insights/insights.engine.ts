import { Injectable } from '@nestjs/common';
import { ExecutiveContext } from '../context/context.types';
import { ExecutiveInsightsRules } from './insights.rules';
import { ExecutiveInsightsResult } from './insights.types';

@Injectable()
export class ExecutiveInsightsEngine {
  build(context: ExecutiveContext): ExecutiveInsightsResult {
    return {
      insightVersion: '1.0',
      generatedAt: context.metadata.generatedAt,
      tenantId: context.metadata.tenantId,
      userId: context.metadata.userId,
      insights: ExecutiveInsightsRules.generate(context),
      excludedSources: context.metadata.excludedSources,
      trends: context.metadata.sourcesIncluded.map((source) => ({
        source,
        trendStatus: 'unavailable' as const,
        reason: 'historical_source_unavailable' as const,
      })),
    };
  }
}
