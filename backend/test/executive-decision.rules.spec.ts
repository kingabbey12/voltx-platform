import { ExecutiveContext, ExecutiveContextItem } from '../src/modules/ai/context/context.types';
import { ExecutiveDecisionEngine } from '../src/modules/ai/decision/decision.engine';
import { DECISION_RULES, ExecutiveDecisionRules } from '../src/modules/ai/decision/decision.rules';
import { DecisionCategory, ExecutiveDecision } from '../src/modules/ai/decision/decision.types';
import { ExecutiveInsightsRules } from '../src/modules/ai/insights/insights.rules';
import {
  ExecutiveInsight,
  ExecutiveInsightsResult,
} from '../src/modules/ai/insights/insights.types';

const EMPTY = { items: [] as ExecutiveContextItem[], total: 0, summary: 'No data available.' };

function item(
  id: string,
  priority: ExecutiveContextItem['priority'],
  extra: Partial<ExecutiveContextItem> = {},
): ExecutiveContextItem {
  return { id, label: `Record ${id}`, priority, ...extra };
}

function buildContext(overrides: Partial<ExecutiveContext> = {}): ExecutiveContext {
  const sourcesIncluded = overrides.metadata?.sourcesIncluded ?? [
    'crm',
    'finance',
    'operations',
    'communications',
  ];
  return {
    organization: { id: 'tenant-1' },
    user: { id: 'user-1' },
    crm: EMPTY,
    finance: EMPTY,
    operations: EMPTY,
    communications: EMPTY,
    notifications: EMPTY,
    calendar: EMPTY,
    ...overrides,
    metadata: {
      generatedAt: '2026-08-02T00:00:00.000Z',
      contextVersion: '1.0',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourcesIncluded,
      excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
      tokenEstimate: 64,
      ...overrides.metadata,
    },
  };
}

/** Runs the real insight rules so decisions are never fed synthetic insights. */
function insightsFor(context: ExecutiveContext): ExecutiveInsightsResult {
  return new ExecutiveDecisionEngineFixture().insights(context);
}

class ExecutiveDecisionEngineFixture {
  insights(context: ExecutiveContext): ExecutiveInsightsResult {
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

function decide(context: ExecutiveContext): ExecutiveDecision[] {
  return ExecutiveDecisionRules.generate({ context, insights: insightsFor(context) });
}

function byRule(decisions: ExecutiveDecision[], ruleId: string): ExecutiveDecision | undefined {
  return decisions.find((decision) => decision.explainability.ruleId === ruleId);
}

describe('ExecutiveDecisionRules', () => {
  describe('rule catalog', () => {
    it('exposes unique, stably ordered rule ids', () => {
      const ids = DECISION_RULES.map((rule) => rule.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ExecutiveDecisionRules.ruleIds).toEqual([...ids].sort());
    });

    it('covers every decision category', () => {
      const required: DecisionCategory[] = [
        'sales',
        'finance',
        'operations',
        'communications',
        'customer_success',
        'risk',
        'executive_priority',
        'compliance',
      ];
      const covered = new Set(DECISION_RULES.map((rule) => rule.category));
      for (const category of required) expect(covered.has(category)).toBe(true);
    });

    it('versions every rule', () => {
      for (const rule of DECISION_RULES) expect(rule.version).toBe('1.0');
    });
  });

  describe('recommendation rules', () => {
    it('recommends reviewing flagged deals when the pipeline has flagged records', () => {
      const decisions = decide(
        buildContext({
          crm: {
            total: 2,
            summary: '2 records included.',
            items: [item('opportunity:a', 'high'), item('opportunity:b', 'high')],
          },
          metadata: { sourcesIncluded: ['crm'] } as ExecutiveContext['metadata'],
        }),
      );
      const decision = byRule(decisions, 'sales.pipeline-attention');

      expect(decision).toBeDefined();
      expect(decision!.category).toBe('sales');
      expect(decision!.recommendedAction.code).toBe('review_major_deals');
      expect(decision!.recommendedAction.type).toBe('review');
      expect(decision!.approvalRequired).toBe(true);
      expect(byRule(decisions, 'sales.pipeline-stalled')).toBeUndefined();
    });

    it('recommends scheduling a sales review when the pipeline is present but unflagged', () => {
      const decisions = decide(
        buildContext({
          crm: {
            total: 1,
            summary: '1 records included.',
            items: [item('opportunity:a', 'medium')],
          },
          metadata: { sourcesIncluded: ['crm'] } as ExecutiveContext['metadata'],
        }),
      );

      expect(byRule(decisions, 'sales.pipeline-stalled')?.recommendedAction.code).toBe(
        'schedule_sales_review',
      );
      expect(byRule(decisions, 'sales.pipeline-attention')).toBeUndefined();
    });

    it('recommends a finance review for flagged finance records', () => {
      const decisions = decide(
        buildContext({
          finance: {
            total: 1,
            summary: '1 records included.',
            items: [item('transaction:a', 'high')],
          },
          metadata: { sourcesIncluded: ['finance'] } as ExecutiveContext['metadata'],
        }),
      );

      expect(byRule(decisions, 'finance.exception-review')?.recommendedAction.code).toBe(
        'review_finance_exceptions',
      );
    });

    it('recommends a budget review only once utilisation reaches the warning ratio', () => {
      const withUtilisation = (budgetUtilization: number) =>
        decide(
          buildContext({
            finance: {
              total: 1,
              summary: '1 records included.',
              items: [
                item('finance:current-month-overview', 'medium', {
                  details: { type: 'finance_overview', budgetUtilization },
                }),
              ],
            },
            metadata: { sourcesIncluded: ['finance'] } as ExecutiveContext['metadata'],
          }),
        );

      expect(byRule(withUtilisation(0.5), 'finance.budget-review')).toBeUndefined();

      const warning = byRule(withUtilisation(0.85), 'finance.budget-review');
      expect(warning?.priority).toBe('high');
      expect(warning?.riskLevel).toBe('high');
      expect(warning?.supportingMetrics.budgetUtilizationPercent).toBe(85);

      const breach = byRule(withUtilisation(1.2), 'finance.budget-review');
      expect(breach?.priority).toBe('critical');
      expect(breach?.riskLevel).toBe('critical');
      expect(breach?.title).toContain('breached');
    });

    it('recommends investigating blocking operational work', () => {
      const decisions = decide(
        buildContext({
          operations: {
            total: 1,
            summary: '1 records included.',
            items: [item('workflow-run:a', 'critical')],
          },
          metadata: { sourcesIncluded: ['operations'] } as ExecutiveContext['metadata'],
        }),
      );

      expect(byRule(decisions, 'operations.blocking-work')?.recommendedAction.code).toBe(
        'investigate_workflow',
      );
    });

    it('recommends an operations review once the open backlog reaches the threshold', () => {
      const items = Array.from({ length: 5 }, (_, index) => item(`activity:${index}`, 'medium'));
      const decisions = decide(
        buildContext({
          operations: { total: 5, summary: '5 records included.', items },
          metadata: { sourcesIncluded: ['operations'] } as ExecutiveContext['metadata'],
        }),
      );

      const decision = byRule(decisions, 'operations.backlog-review');
      expect(decision?.recommendedAction.code).toBe('schedule_operations_review');
      expect(decision?.supportingMetrics.recordsAvailable).toBe(5);

      const belowThreshold = decide(
        buildContext({
          operations: {
            total: 4,
            summary: '4 records included.',
            items: items.slice(0, 4),
          },
          metadata: { sourcesIncluded: ['operations'] } as ExecutiveContext['metadata'],
        }),
      );
      expect(byRule(belowThreshold, 'operations.backlog-review')).toBeUndefined();
    });

    it('recommends a customer support intervention for escalated conversations', () => {
      const decisions = decide(
        buildContext({
          communications: {
            total: 2,
            summary: '2 records included.',
            items: [item('conversation:a', 'critical'), item('conversation:b', 'medium')],
          },
          metadata: { sourcesIncluded: ['communications'] } as ExecutiveContext['metadata'],
        }),
      );

      const escalation = byRule(decisions, 'customer_success.escalation-intervention');
      expect(escalation?.category).toBe('customer_success');
      expect(escalation?.recommendedAction.code).toBe('escalate_customer_issue');
      expect(escalation?.priority).toBe('critical');
      // Only the escalated record is carried as evidence.
      expect(escalation?.evidence.map((entry) => entry.id)).toEqual(['conversation:a']);
      expect(byRule(decisions, 'communications.priority-review')?.category).toBe('communications');
    });

    it('raises a risk decision whenever any business area is critical', () => {
      const decisions = decide(
        buildContext({
          operations: {
            total: 1,
            summary: '1 records included.',
            items: [item('workflow-run:a', 'critical')],
          },
          metadata: { sourcesIncluded: ['operations'] } as ExecutiveContext['metadata'],
        }),
      );

      const risk = byRule(decisions, 'risk.critical-exposure');
      expect(risk?.category).toBe('risk');
      expect(risk?.priority).toBe('critical');
      expect(risk?.riskLevel).toBe('critical');
      expect(risk?.urgency).toBe('immediate');
    });

    it('raises a compliance decision when permissions restrict visibility', () => {
      const decisions = decide(
        buildContext({
          crm: { total: 1, summary: '1 records included.', items: [item('opportunity:a', 'high')] },
          metadata: {
            sourcesIncluded: ['crm'],
            excludedSources: [
              { source: 'calendar', reason: 'calendar_not_available' },
              { source: 'finance', reason: 'missing_permission' },
            ],
          } as ExecutiveContext['metadata'],
        }),
      );

      const compliance = byRule(decisions, 'compliance.restricted-visibility');
      expect(compliance?.category).toBe('compliance');
      expect(compliance?.supportingMetrics.restrictedSources).toBe(1);
      expect(compliance?.explainability.permissionLimitations).toEqual([
        'The finance source was excluded because the role cannot read it.',
      ]);
    });

    it('produces an informational executive-priority briefing that needs no approval', () => {
      const decisions = decide(
        buildContext({
          crm: { total: 1, summary: '1 records included.', items: [item('opportunity:a', 'high')] },
          metadata: { sourcesIncluded: ['crm'] } as ExecutiveContext['metadata'],
        }),
      );

      const briefing = byRule(decisions, 'executive.top-priority');
      expect(briefing?.category).toBe('executive_priority');
      expect(briefing?.approvalRequired).toBe(false);
      expect(briefing?.recommendedAction.type).toBe('review');
    });
  });

  describe('derivations', () => {
    const context = buildContext({
      crm: {
        total: 3,
        summary: '3 records included.',
        items: [
          item('opportunity:a', 'high'),
          item('opportunity:b', 'high'),
          item('opportunity:c', 'high'),
        ],
      },
      communications: {
        total: 1,
        summary: '1 records included.',
        items: [item('conversation:a', 'critical')],
      },
      metadata: { sourcesIncluded: ['crm', 'communications'] } as ExecutiveContext['metadata'],
    });

    it('orders decisions by priority, then risk, then stable rule id', () => {
      const decisions = decide(context);
      const weight = { critical: 4, high: 3, medium: 2, low: 1 } as const;

      expect(decisions.length).toBeGreaterThan(1);
      for (let index = 1; index < decisions.length; index += 1) {
        const previous = decisions[index - 1];
        const current = decisions[index];
        const byPriority = weight[previous.priority] - weight[current.priority];
        expect(byPriority).toBeGreaterThanOrEqual(0);
        if (byPriority !== 0) continue;
        const byRisk = weight[previous.riskLevel] - weight[current.riskLevel];
        expect(byRisk).toBeGreaterThanOrEqual(0);
        if (byRisk === 0) expect(previous.id.localeCompare(current.id)).toBeLessThanOrEqual(0);
      }
    });

    it('derives confidence from the weakest source insight', () => {
      const decisions = decide(context);
      const insights = insightsFor(context).insights;
      const weight = { high: 3, medium: 2, low: 1 } as const;

      for (const decision of decisions) {
        if (decision.insightIdsUsed.length === 0) continue;
        const used = decision.insightIdsUsed
          .map((id) => insights.find((insight: ExecutiveInsight) => insight.id === id))
          .filter((insight): insight is ExecutiveInsight => Boolean(insight));
        const weakest = used.reduce(
          (lowest, insight) =>
            weight[insight.confidence] < weight[lowest] ? insight.confidence : lowest,
          'high' as ExecutiveInsight['confidence'],
        );
        expect(decision.confidence).toBe(weakest);
        expect(decision.explainability.confidenceReason).toContain(decision.confidence);
      }
    });

    it('maps urgency deterministically from priority', () => {
      const expected = {
        critical: 'immediate',
        high: 'this_week',
        medium: 'this_month',
        low: 'monitor',
      } as const;
      for (const decision of decide(context)) {
        expect(decision.urgency).toBe(expected[decision.priority]);
      }
    });

    it('bounds evidence and de-duplicates it by record id', () => {
      const many = buildContext({
        crm: {
          total: 12,
          summary: '12 records included.',
          items: Array.from({ length: 12 }, (_, index) =>
            item(`opportunity:${String(index).padStart(2, '0')}`, 'high'),
          ),
        },
        metadata: { sourcesIncluded: ['crm'] } as ExecutiveContext['metadata'],
      });

      for (const decision of decide(many)) {
        expect(decision.evidence.length).toBeLessThanOrEqual(5);
        expect(new Set(decision.evidence.map((entry) => entry.id)).size).toBe(
          decision.evidence.length,
        );
      }
    });

    it('never emits an executing recommendation and always explains itself', () => {
      for (const decision of decide(context)) {
        expect(decision.recommendedAction.executes).toBe(false);
        expect(decision.explainability.ruleId).toBeTruthy();
        expect(decision.explainability.ruleVersion).toBe('1.0');
        expect(decision.explainability.priorityReason).toContain(decision.priority);
        expect(decision.explainability.riskReason).toContain(decision.riskLevel);
        expect(decision.explainability.contextSourcesUsed).toEqual(decision.contextSourcesUsed);
        expect(decision.excludedSources).toEqual(decision.explainability.excludedSources);
        expect(decision.title.length).toBeGreaterThan(0);
        expect(decision.summary.length).toBeGreaterThan(0);
      }
    });

    it('requires approval for every business-changing recommendation', () => {
      const informational = ['review_top_priority'];
      for (const decision of decide(context)) {
        if (informational.includes(decision.recommendedAction.code)) {
          expect(decision.approvalRequired).toBe(false);
        } else {
          expect(decision.approvalRequired).toBe(true);
        }
        expect(decision.approvalRequired).toBe(decision.recommendedAction.requiresApproval);
      }
    });

    it('produces identical decisions for identical input', () => {
      expect(decide(context)).toEqual(decide(context));
    });

    it('emits no decisions at all when there is no permitted context', () => {
      const empty = buildContext({
        metadata: {
          sourcesIncluded: [],
          excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
        } as unknown as ExecutiveContext['metadata'],
      });
      expect(decide(empty)).toEqual([]);
    });
  });
});

describe('ExecutiveDecisionEngine', () => {
  it('summarizes the decision set without re-deriving any rule', () => {
    const context = buildContext({
      crm: { total: 1, summary: '1 records included.', items: [item('opportunity:a', 'high')] },
      metadata: { sourcesIncluded: ['crm'] } as ExecutiveContext['metadata'],
    });
    const insights = insightsFor(context);
    const result = new ExecutiveDecisionEngine().build(context, insights);

    expect(result.decisionVersion).toBe('1.0');
    expect(result.generatedAt).toBe(insights.generatedAt);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.userId).toBe('user-1');
    expect(result.insightsConsidered).toBe(insights.insights.length);
    expect(result.rulesEvaluated).toEqual(ExecutiveDecisionRules.ruleIds);
    expect(result.excludedSources).toEqual(insights.excludedSources);

    const distributionTotal = Object.values(result.priorityDistribution).reduce(
      (total, count) => total + count,
      0,
    );
    expect(distributionTotal).toBe(result.decisions.length);
    expect(result.approvalRequiredCount).toBe(
      result.decisions.filter((decision) => decision.approvalRequired).length,
    );
  });
});
