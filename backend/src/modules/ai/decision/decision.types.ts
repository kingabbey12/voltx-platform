import { ExecutiveContextItem, ExecutiveContextSource } from '../context/context.types';

export type DecisionCategory =
  | 'sales'
  | 'finance'
  | 'operations'
  | 'communications'
  | 'customer_success'
  | 'risk'
  | 'executive_priority'
  | 'compliance';

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';
export type DecisionConfidence = 'high' | 'medium' | 'low';
export type DecisionRiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type DecisionUrgency = 'immediate' | 'this_week' | 'this_month' | 'monitor';

/**
 * The recommendation vocabulary. Every value describes work a human does;
 * none of them names an operation this engine can perform, which is what
 * keeps "recommend, never execute" a property of the type rather than of
 * a code path someone has to remember not to add.
 */
export type DecisionActionType =
  'review' | 'investigate' | 'escalate' | 'schedule' | 'assign' | 'approve' | 'follow_up';

export interface DecisionRecommendedAction {
  /** Stable machine code, safe as a metric label and as a UI key. */
  code: string;
  label: string;
  type: DecisionActionType;
  requiresApproval: boolean;
  /** Structurally `false`: the Decision Engine has no execution path. */
  executes: false;
}

export interface DecisionExcludedSource {
  source: ExecutiveContextSource;
  reason: string;
}

/**
 * Everything needed to answer "why am I being told this?" without
 * re-running the engine.
 */
export interface DecisionExplainability {
  ruleId: string;
  ruleVersion: string;
  insightIdsUsed: string[];
  contextSourcesUsed: ExecutiveContextSource[];
  excludedSources: DecisionExcludedSource[];
  priorityReason: string;
  confidenceReason: string;
  riskReason: string;
  /** Safe, generic statements about what the caller could not see. */
  permissionLimitations: string[];
}

export interface ExecutiveDecision {
  id: string;
  category: DecisionCategory;
  title: string;
  summary: string;
  priority: DecisionPriority;
  confidence: DecisionConfidence;
  businessImpact: DecisionPriority;
  urgency: DecisionUrgency;
  riskLevel: DecisionRiskLevel;
  evidence: ExecutiveContextItem[];
  supportingMetrics: Record<string, number>;
  /** Permissions a human would need to carry the recommendation out. */
  requiredPermissions: string[];
  recommendedAction: DecisionRecommendedAction;
  approvalRequired: boolean;
  generatedAt: string;
  insightIdsUsed: string[];
  contextSourcesUsed: ExecutiveContextSource[];
  excludedSources: DecisionExcludedSource[];
  explainability: DecisionExplainability;
}

export interface ExecutiveDecisionsResult {
  decisionVersion: '1.0';
  generatedAt: string;
  tenantId: string;
  userId: string;
  decisions: ExecutiveDecision[];
  excludedSources: DecisionExcludedSource[];
  /** How many insights the rule set was offered. */
  insightsConsidered: number;
  /** Every rule id that was evaluated, matched or not — deterministic order. */
  rulesEvaluated: string[];
  priorityDistribution: Record<DecisionPriority, number>;
  approvalRequiredCount: number;
}
