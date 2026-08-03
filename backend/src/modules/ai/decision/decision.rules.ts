import { ExecutiveContext, ExecutiveContextItem } from '../context/context.types';
import { ExecutiveInsight, ExecutiveInsightsResult } from '../insights/insights.types';
import {
  DecisionActionType,
  DecisionCategory,
  DecisionConfidence,
  DecisionPriority,
  DecisionRiskLevel,
  DecisionUrgency,
  ExecutiveDecision,
} from './decision.types';

export const DECISION_RULE_VERSION = '1.0';

const PRIORITY_WEIGHT: Record<DecisionPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
const CONFIDENCE_WEIGHT: Record<DecisionConfidence, number> = { high: 3, medium: 2, low: 1 };

const URGENCY_FOR_PRIORITY: Record<DecisionPriority, DecisionUrgency> = {
  critical: 'immediate',
  high: 'this_week',
  medium: 'this_month',
  low: 'monitor',
};

/** Budget utilisation at or above this share triggers a budget review. */
const BUDGET_WARNING_RATIO = 0.8;
/** Above this share the budget is treated as breached rather than at risk. */
const BUDGET_BREACH_RATIO = 1;
/** Open operational records at or above this count trigger a scheduled review. */
const OPERATIONS_BACKLOG_THRESHOLD = 5;
/** Evidence carried onto a decision, bounded so output stays predictable. */
const MAX_DECISION_EVIDENCE = 5;

/** What a rule produces before the shared derivations are applied. */
interface DecisionDraft {
  title: string;
  summary: string;
  insights: ExecutiveInsight[];
  evidence: ExecutiveContextItem[];
  supportingMetrics: Record<string, number>;
  requiredPermissions: string[];
  action: { code: string; label: string; type: DecisionActionType; requiresApproval: boolean };
  /** Raises the derived priority to at least this level. */
  priorityFloor?: DecisionPriority;
  /** Raises the derived risk to at least this level. */
  riskFloor?: DecisionRiskLevel;
  /** Appended to the generated priority explanation. */
  priorityReason: string;
}

export interface DecisionRuleInput {
  context: ExecutiveContext;
  insights: ExecutiveInsightsResult;
}

export interface DecisionRule {
  id: string;
  version: string;
  category: DecisionCategory;
  evaluate(input: DecisionRuleInput): DecisionDraft | null;
}

function insightBy(input: DecisionRuleInput, category: string): ExecutiveInsight | undefined {
  return input.insights.insights.find((insight) => insight.category === category);
}

function metric(insight: ExecutiveInsight | undefined, key: string): number {
  return insight?.supportingMetrics[key] ?? 0;
}

/** The finance overview record the Executive Context Engine already emits. */
function financeOverview(context: ExecutiveContext): ExecutiveContextItem | undefined {
  return context.finance.items.find((item) => item.id === 'finance:current-month-overview');
}

function budgetUtilisation(context: ExecutiveContext): number | null {
  const value = financeOverview(context)?.details?.budgetUtilization;
  return typeof value === 'number' ? value : null;
}

export const DECISION_RULES: DecisionRule[] = [
  {
    id: 'sales.pipeline-attention',
    version: DECISION_RULE_VERSION,
    category: 'sales',
    evaluate(input) {
      const insight = insightBy(input, 'sales');
      if (!insight || insight.evidence.length === 0) return null;
      const flagged = metric(insight, 'criticalRecords') + metric(insight, 'highPriorityRecords');
      if (flagged === 0) return null;
      return {
        title: 'Review the highest-value deals needing attention',
        summary: `${flagged} of ${insight.evidence.length} permitted pipeline records are flagged critical or high priority.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          flaggedRecords: flagged,
          evidenceRecords: insight.evidence.length,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['sales.opportunity.read', 'sales.opportunity.update'],
        action: {
          code: 'review_major_deals',
          label: 'Review and follow up on the flagged deals',
          type: 'review',
          requiresApproval: true,
        },
        priorityReason: `${flagged} flagged pipeline records`,
      };
    },
  },
  {
    id: 'sales.pipeline-stalled',
    version: DECISION_RULE_VERSION,
    category: 'sales',
    evaluate(input) {
      const insight = insightBy(input, 'sales');
      if (!insight || insight.evidence.length === 0) return null;
      const flagged = metric(insight, 'criticalRecords') + metric(insight, 'highPriorityRecords');
      if (flagged > 0) return null;
      return {
        title: 'Schedule a pipeline review',
        summary: `${insight.evidence.length} permitted pipeline records are present but none is flagged, which reads as a stalled rather than an urgent pipeline.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          flaggedRecords: 0,
          evidenceRecords: insight.evidence.length,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['sales.opportunity.read', 'sales.activity.create'],
        action: {
          code: 'schedule_sales_review',
          label: 'Schedule a sales pipeline review',
          type: 'schedule',
          requiresApproval: true,
        },
        priorityReason: 'no flagged pipeline records',
      };
    },
  },
  {
    id: 'finance.exception-review',
    version: DECISION_RULE_VERSION,
    category: 'finance',
    evaluate(input) {
      const insight = insightBy(input, 'finance');
      if (!insight || insight.evidence.length === 0) return null;
      const flagged = metric(insight, 'criticalRecords') + metric(insight, 'highPriorityRecords');
      if (flagged === 0) return null;
      return {
        title: 'Review outstanding finance exceptions',
        summary: `${flagged} permitted finance records are flagged for review.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          flaggedRecords: flagged,
          evidenceRecords: insight.evidence.length,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['finance.transaction.read', 'finance.transaction.update'],
        action: {
          code: 'review_finance_exceptions',
          label: 'Review the flagged finance records',
          type: 'review',
          requiresApproval: true,
        },
        priorityReason: `${flagged} flagged finance records`,
      };
    },
  },
  {
    id: 'finance.budget-review',
    version: DECISION_RULE_VERSION,
    category: 'finance',
    evaluate(input) {
      const insight = insightBy(input, 'finance');
      const utilisation = budgetUtilisation(input.context);
      if (!insight || utilisation === null || utilisation < BUDGET_WARNING_RATIO) return null;
      const breached = utilisation >= BUDGET_BREACH_RATIO;
      const overview = financeOverview(input.context);
      return {
        title: breached
          ? 'Review a breached operating budget'
          : 'Review a budget nearing its limit',
        summary: `Verified current-period budget utilisation is ${Math.round(utilisation * 100)}% of the budgeted amount.`,
        insights: [insight],
        evidence: overview ? [overview] : insight.evidence,
        supportingMetrics: {
          budgetUtilizationPercent: Math.round(utilisation * 100),
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['finance.budget.read', 'finance.budget.update'],
        action: {
          code: 'review_budget',
          label: 'Review budget utilisation before further commitments',
          type: 'review',
          requiresApproval: true,
        },
        priorityFloor: breached ? 'critical' : 'high',
        riskFloor: breached ? 'critical' : 'high',
        priorityReason: `budget utilisation ${Math.round(utilisation * 100)}%`,
      };
    },
  },
  {
    id: 'operations.blocking-work',
    version: DECISION_RULE_VERSION,
    category: 'operations',
    evaluate(input) {
      const insight = insightBy(input, 'operations');
      if (!insight) return null;
      const flagged = metric(insight, 'criticalRecords') + metric(insight, 'highPriorityRecords');
      if (flagged === 0) return null;
      return {
        title: 'Investigate blocking operational work',
        summary: `${flagged} permitted operational records are flagged critical or high priority.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          flaggedRecords: flagged,
          evidenceRecords: insight.evidence.length,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['sales.activity.read', 'workflow.read'],
        action: {
          code: 'investigate_workflow',
          label: 'Investigate and unblock the flagged operational work',
          type: 'investigate',
          requiresApproval: true,
        },
        priorityReason: `${flagged} flagged operational records`,
      };
    },
  },
  {
    id: 'operations.backlog-review',
    version: DECISION_RULE_VERSION,
    category: 'operations',
    evaluate(input) {
      const insight = insightBy(input, 'operations');
      if (!insight) return null;
      const available = metric(insight, 'recordsAvailable');
      if (available < OPERATIONS_BACKLOG_THRESHOLD) return null;
      return {
        title: 'Schedule an operations review',
        summary: `${available} permitted open operational records are outstanding, at or above the review threshold of ${OPERATIONS_BACKLOG_THRESHOLD}.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          recordsAvailable: available,
          backlogThreshold: OPERATIONS_BACKLOG_THRESHOLD,
        },
        requiredPermissions: ['sales.activity.read', 'sales.activity.update'],
        action: {
          code: 'schedule_operations_review',
          label: 'Schedule an operations backlog review',
          type: 'schedule',
          requiresApproval: true,
        },
        priorityReason: `${available} open operational records`,
      };
    },
  },
  {
    id: 'communications.priority-review',
    version: DECISION_RULE_VERSION,
    category: 'communications',
    evaluate(input) {
      const insight = insightBy(input, 'communications');
      if (!insight || insight.evidence.length === 0) return null;
      return {
        title: 'Review priority customer conversations',
        summary: `${insight.evidence.length} permitted conversations are awaiting a response.`,
        insights: [insight],
        evidence: insight.evidence,
        supportingMetrics: {
          evidenceRecords: insight.evidence.length,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: ['communications.conversation.read', 'communications.message.create'],
        action: {
          code: 'follow_up_customer',
          label: 'Follow up on the waiting customer conversations',
          type: 'follow_up',
          requiresApproval: true,
        },
        priorityReason: `${insight.evidence.length} waiting conversations`,
      };
    },
  },
  {
    id: 'customer_success.escalation-intervention',
    version: DECISION_RULE_VERSION,
    category: 'customer_success',
    evaluate(input) {
      const insight = insightBy(input, 'communications');
      const escalations = metric(insight, 'criticalRecords');
      if (!insight || escalations === 0) return null;
      return {
        title: 'Intervene on escalated customer conversations',
        summary: `${escalations} permitted conversations are marked as escalations and need a support intervention.`,
        insights: [insight],
        evidence: insight.evidence.filter((item) => item.priority === 'critical'),
        supportingMetrics: {
          escalatedRecords: escalations,
          recordsAvailable: metric(insight, 'recordsAvailable'),
        },
        requiredPermissions: [
          'communications.conversation.read',
          'communications.conversation.update',
        ],
        action: {
          code: 'escalate_customer_issue',
          label: 'Assign a support intervention for the escalated conversations',
          type: 'escalate',
          requiresApproval: true,
        },
        priorityFloor: 'critical',
        riskFloor: 'critical',
        priorityReason: `${escalations} escalated conversations`,
      };
    },
  },
  {
    id: 'risk.critical-exposure',
    version: DECISION_RULE_VERSION,
    category: 'risk',
    evaluate(input) {
      const exposed = input.insights.insights.filter(
        (insight) => insight.category !== 'executive_summary' && insight.priority === 'critical',
      );
      if (exposed.length === 0) return null;
      return {
        title: 'Escalate critical business exposure for executive review',
        summary: `${exposed.length} permitted business areas are at critical priority: ${exposed
          .map((insight) => insight.affectedModule)
          .join(', ')}.`,
        insights: exposed,
        evidence: exposed.flatMap((insight) => insight.evidence),
        supportingMetrics: {
          criticalAreas: exposed.length,
          criticalRecords: exposed.reduce(
            (total, insight) => total + metric(insight, 'criticalRecords'),
            0,
          ),
        },
        requiredPermissions: ['ai.approval.decide'],
        action: {
          code: 'escalate_business_risk',
          label: 'Escalate the critical areas for executive review',
          type: 'escalate',
          requiresApproval: true,
        },
        priorityFloor: 'critical',
        riskFloor: 'critical',
        priorityReason: `${exposed.length} critical business areas`,
      };
    },
  },
  {
    id: 'executive.top-priority',
    version: DECISION_RULE_VERSION,
    category: 'executive_priority',
    evaluate(input) {
      const summary = insightBy(input, 'executive_summary');
      if (!summary) return null;
      return {
        title: 'Start with the highest-priority verified item',
        summary: summary.summary,
        insights: [summary],
        evidence: summary.evidence,
        supportingMetrics: {
          evidenceRecords: summary.evidence.length,
          insightsAvailable: input.insights.insights.length,
        },
        requiredPermissions: [],
        action: {
          code: 'review_top_priority',
          label: 'Review the highest-priority item first',
          type: 'review',
          // Briefing only: reading a ranked list changes no business state,
          // so this is the one recommendation that needs no approval.
          requiresApproval: false,
        },
        priorityReason: 'derived from the executive summary insight',
      };
    },
  },
  {
    id: 'compliance.restricted-visibility',
    version: DECISION_RULE_VERSION,
    category: 'compliance',
    evaluate(input) {
      const restricted = input.insights.excludedSources.filter(
        (entry) => entry.reason === 'missing_permission',
      );
      if (restricted.length === 0) return null;
      return {
        title: 'Review the access scope limiting executive visibility',
        summary: `${restricted.length} business sources were excluded from this decision set because the requesting role cannot read them.`,
        insights: [],
        evidence: [],
        supportingMetrics: {
          restrictedSources: restricted.length,
          includedSources: input.insights.insights.length,
        },
        requiredPermissions: ['role.read', 'permission.read'],
        action: {
          code: 'review_access_scope',
          label: 'Review whether the current role should see the excluded sources',
          type: 'review',
          requiresApproval: true,
        },
        priorityReason: `${restricted.length} sources excluded by permission`,
      };
    },
  },
];

export class ExecutiveDecisionRules {
  static readonly ruleIds: string[] = DECISION_RULES.map((rule) => rule.id).sort();

  static generate(input: DecisionRuleInput): ExecutiveDecision[] {
    const decisions: ExecutiveDecision[] = [];
    for (const rule of [...DECISION_RULES].sort((left, right) => left.id.localeCompare(right.id))) {
      const draft = rule.evaluate(input);
      if (draft) decisions.push(this.materialize(rule, draft, input));
    }
    return decisions.sort(
      (left, right) =>
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
        PRIORITY_WEIGHT[right.riskLevel] - PRIORITY_WEIGHT[left.riskLevel] ||
        left.id.localeCompare(right.id),
    );
  }

  private static materialize(
    rule: DecisionRule,
    draft: DecisionDraft,
    input: DecisionRuleInput,
  ): ExecutiveDecision {
    const priority = this.priorityFor(draft);
    const riskLevel = this.riskFor(draft);
    const confidence = this.confidenceFor(draft);
    const evidence = this.rankEvidence(draft.evidence);
    const contextSourcesUsed = [
      ...new Set(draft.insights.flatMap((insight) => insight.sourcesUsed)),
    ].sort();
    const permissionLimitations = input.insights.excludedSources
      .filter((entry) => entry.reason === 'missing_permission')
      .map((entry) => `The ${entry.source} source was excluded because the role cannot read it.`)
      .sort();

    return {
      id: `decision:${rule.id}`,
      category: rule.category,
      title: draft.title,
      summary: draft.summary,
      priority,
      confidence,
      businessImpact: this.businessImpactFor(draft, priority),
      urgency: URGENCY_FOR_PRIORITY[priority],
      riskLevel,
      evidence,
      supportingMetrics: draft.supportingMetrics,
      requiredPermissions: [...draft.requiredPermissions].sort(),
      recommendedAction: { ...draft.action, executes: false },
      approvalRequired: draft.action.requiresApproval,
      generatedAt: input.insights.generatedAt,
      insightIdsUsed: draft.insights.map((insight) => insight.id).sort(),
      contextSourcesUsed,
      excludedSources: input.insights.excludedSources,
      explainability: {
        ruleId: rule.id,
        ruleVersion: rule.version,
        insightIdsUsed: draft.insights.map((insight) => insight.id).sort(),
        contextSourcesUsed,
        excludedSources: input.insights.excludedSources,
        priorityReason: `Priority ${priority} from ${draft.priorityReason}.`,
        confidenceReason: this.confidenceReason(draft, confidence),
        riskReason: this.riskReason(draft, riskLevel),
        permissionLimitations,
      },
    };
  }

  /** Highest priority among the insights the rule used, raised by any floor. */
  private static priorityFor(draft: DecisionDraft): DecisionPriority {
    const derived = draft.insights.reduce<DecisionPriority>(
      (highest, insight) =>
        PRIORITY_WEIGHT[insight.priority] > PRIORITY_WEIGHT[highest] ? insight.priority : highest,
      'low',
    );
    return this.raise(derived, draft.priorityFloor);
  }

  private static businessImpactFor(
    draft: DecisionDraft,
    priority: DecisionPriority,
  ): DecisionPriority {
    const derived = draft.insights.reduce<DecisionPriority>(
      (highest, insight) =>
        PRIORITY_WEIGHT[insight.businessImpact] > PRIORITY_WEIGHT[highest]
          ? insight.businessImpact
          : highest,
      'low',
    );
    return this.raise(derived, priority === 'critical' ? 'critical' : undefined);
  }

  /**
   * Critical when the evidence itself is critical, high when it is flagged,
   * medium when there is any evidence at all, low when there is none.
   */
  private static riskFor(draft: DecisionDraft): DecisionRiskLevel {
    const critical = draft.insights.some((insight) => metric(insight, 'criticalRecords') > 0);
    const high = draft.insights.some((insight) => metric(insight, 'highPriorityRecords') > 0);
    const derived: DecisionRiskLevel = critical
      ? 'critical'
      : high
        ? 'high'
        : draft.evidence.length > 0
          ? 'medium'
          : 'low';
    return this.raise(derived, draft.riskFloor);
  }

  /** The weakest confidence of any insight the rule relied on. */
  private static confidenceFor(draft: DecisionDraft): DecisionConfidence {
    if (draft.insights.length === 0) return draft.evidence.length > 0 ? 'medium' : 'low';
    return draft.insights.reduce<DecisionConfidence>(
      (lowest, insight) =>
        CONFIDENCE_WEIGHT[insight.confidence] < CONFIDENCE_WEIGHT[lowest]
          ? insight.confidence
          : lowest,
      'high',
    );
  }

  private static confidenceReason(draft: DecisionDraft, confidence: DecisionConfidence): string {
    if (draft.insights.length === 0) {
      return `Confidence ${confidence} because this decision is derived from context metadata rather than insight evidence.`;
    }
    return `Confidence ${confidence}, the weakest confidence among ${draft.insights.length} source insight(s) carrying ${draft.evidence.length} evidence record(s).`;
  }

  private static riskReason(draft: DecisionDraft, risk: DecisionRiskLevel): string {
    const critical = draft.insights.reduce(
      (total, insight) => total + metric(insight, 'criticalRecords'),
      0,
    );
    const high = draft.insights.reduce(
      (total, insight) => total + metric(insight, 'highPriorityRecords'),
      0,
    );
    return `Risk ${risk} from ${critical} critical and ${high} high-priority verified record(s).`;
  }

  private static rankEvidence(evidence: ExecutiveContextItem[]): ExecutiveContextItem[] {
    const unique = new Map(evidence.map((item) => [item.id, item]));
    return [...unique.values()]
      .sort(
        (left, right) =>
          PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
          left.id.localeCompare(right.id),
      )
      .slice(0, MAX_DECISION_EVIDENCE);
  }

  private static raise<T extends string>(derived: T, floor: T | undefined): T {
    if (!floor) return derived;
    const weight = PRIORITY_WEIGHT as unknown as Record<string, number>;
    return weight[floor] > weight[derived] ? floor : derived;
  }
}
