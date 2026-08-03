import { Injectable } from '@nestjs/common';
import { ExecutiveContext } from '../context/context.types';
import { ExecutiveInsightsResult } from '../insights/insights.types';
import { ExecutiveDecisionRules } from './decision.rules';
import { DecisionPriority, ExecutiveDecisionsResult } from './decision.types';

/**
 * Pure, synchronous, side-effect free. It receives the already-verified
 * Executive Context and Executive Insights and never reaches past them —
 * there is no Prisma client, HTTP client or AI provider in this file's
 * dependency graph, which is what makes "no raw database access" checkable
 * rather than aspirational.
 */
@Injectable()
export class ExecutiveDecisionEngine {
  build(context: ExecutiveContext, insights: ExecutiveInsightsResult): ExecutiveDecisionsResult {
    const decisions = ExecutiveDecisionRules.generate({ context, insights });
    const priorityDistribution: Record<DecisionPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const decision of decisions) priorityDistribution[decision.priority] += 1;

    return {
      decisionVersion: '1.0',
      generatedAt: insights.generatedAt,
      tenantId: insights.tenantId,
      userId: insights.userId,
      decisions,
      excludedSources: insights.excludedSources,
      insightsConsidered: insights.insights.length,
      rulesEvaluated: ExecutiveDecisionRules.ruleIds,
      priorityDistribution,
      approvalRequiredCount: decisions.filter((decision) => decision.approvalRequired).length,
    };
  }
}
