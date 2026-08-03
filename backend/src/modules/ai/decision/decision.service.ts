import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MetricsService } from '../../metrics/metrics.service';
import { ExecutiveContextService } from '../context/context.service';
import { ExecutiveContext } from '../context/context.types';
import { ExecutiveInsightsService } from '../insights/insights.service';
import { ExecutiveInsightsResult } from '../insights/insights.types';
import { ExecutiveDecisionEngine } from './decision.engine';
import { ExecutiveDecisionsResult } from './decision.types';

@Injectable()
export class ExecutiveDecisionsService {
  constructor(
    private readonly context: ExecutiveContextService,
    private readonly insights: ExecutiveInsightsService,
    private readonly engine: ExecutiveDecisionEngine,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Full path used by the HTTP controller. Both calls resolve against the
   * same tenant-scoped, permission-filtered Executive Context — the second
   * is served from the context cache rather than re-querying any domain.
   */
  async generate(permissions: string[]): Promise<ExecutiveDecisionsResult> {
    const startedAt = performance.now();
    try {
      const [context, insights] = await Promise.all([
        this.context.getExecutiveContext({ permissions }),
        this.insights.generate(permissions),
      ]);
      return await this.record(context, insights, startedAt);
    } catch (error) {
      this.metrics.recordExecutiveDecisionsRequest('failure');
      throw error;
    }
  }

  /**
   * Used by callers that already hold a verified context and insight set
   * (the Executive Assistant), so one assistant turn never assembles the
   * same context twice or re-runs the insight rules.
   */
  async generateFrom(
    context: ExecutiveContext,
    insights: ExecutiveInsightsResult,
  ): Promise<ExecutiveDecisionsResult> {
    const startedAt = performance.now();
    try {
      return await this.record(context, insights, startedAt);
    } catch (error) {
      this.metrics.recordExecutiveDecisionsRequest('failure');
      throw error;
    }
  }

  private async record(
    context: ExecutiveContext,
    insights: ExecutiveInsightsResult,
    startedAt: number,
  ): Promise<ExecutiveDecisionsResult> {
    const result = this.engine.build(context, insights);
    await this.audit.record({
      action: 'generate',
      resource: 'executive_decisions',
      resourceId: result.tenantId,
      metadata: {
        decisionCount: result.decisions.length,
        approvalRequiredCount: result.approvalRequiredCount,
      },
    });
    this.metrics.recordExecutiveDecisionsRequest('success');
    this.metrics.recordExecutiveDecisionsDuration(performance.now() - startedAt);
    for (const [priority, count] of Object.entries(result.priorityDistribution)) {
      if (count > 0) this.metrics.recordExecutiveDecisionPriority(priority, count);
    }
    for (const decision of result.decisions) {
      this.metrics.recordExecutiveDecisionCategory(decision.category);
      this.metrics.recordExecutiveDecisionRuleMatch(decision.explainability.ruleId);
      this.metrics.recordExecutiveDecisionApproval(decision.approvalRequired);
    }
    return result;
  }
}
