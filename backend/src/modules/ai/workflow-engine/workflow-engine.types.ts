import { ExecutiveContextItem, ExecutiveContextSource } from '../context/context.types';
import { DecisionCategory } from '../decision/decision.types';

/**
 * The plan lifecycle as the API expresses it. There is deliberately no
 * `executed` member: the AI module generates, submits for approval and
 * hands off. The existing workflow module owns execution, so nothing this
 * engine can set represents "the AI performed a business action".
 */
export type WorkflowPlanStatus =
  'awaiting_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'handed_off';

export type WorkflowPlanStepType = 'review' | 'draft' | 'notify' | 'suggest_approval';

export interface WorkflowPlanStep {
  order: number;
  /** Stable within a plan — the handoff maps this to a workflow step id. */
  key: string;
  title: string;
  type: WorkflowPlanStepType;
  /** Which decision this step traces back to. */
  decisionId: string;
  requiredPermissions: string[];
  estimatedMinutes: number;
}

export interface WorkflowPlanEvidenceRef {
  id: string;
  label: string;
  priority: ExecutiveContextItem['priority'];
  decisionId: string;
}

export interface WorkflowPlan {
  /** Deterministic within a generation; the persisted row carries a uuid. */
  id: string;
  /** Stable identity across regenerations — the idempotency anchor. */
  planKey: string;
  version: '1.0';
  category: DecisionCategory;
  title: string;
  summary: string;
  objective: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: string;
  businessImpact: string;
  confidence: 'high' | 'medium' | 'low';
  risk: 'critical' | 'high' | 'medium' | 'low';
  decisionIds: string[];
  insightIds: string[];
  contextSources: ExecutiveContextSource[];
  evidence: WorkflowPlanEvidenceRef[];
  steps: WorkflowPlanStep[];
  estimatedDurationMinutes: number;
  requiredRoles: string[];
  requiredPermissions: string[];
  approvalRequired: true;
  explainability: {
    ruleId: string;
    ruleVersion: '1.0';
    excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
    priorityReason: string;
    confidenceReason: string;
    riskReason: string;
    approvalReason: string;
    permissionLimitations: string[];
  };
}

/** A plan as persisted and returned by the API, with lifecycle state. */
export interface StoredWorkflowPlan {
  id: string;
  tenantId: string;
  userId: string;
  planKey: string;
  planVersion: string;
  plan: WorkflowPlan;
  status: WorkflowPlanStatus;
  approvalId: string | null;
  workflowId: string | null;
  workflowExecutionId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  handedOffAt: string | null;
}

export interface WorkflowPlansResult {
  planSetVersion: '1.0';
  generatedAt: string;
  tenantId: string;
  userId: string;
  plans: StoredWorkflowPlan[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  decisionsConsidered: number;
  plansGenerated: number;
}

export interface WorkflowPlanApprovalPayload {
  planId: string;
  planVersion: string;
  title: string;
  objective: string;
  priority: string;
  risk: string;
  requiredPermissions: string[];
  requiredRoles: string[];
  steps: Array<{ order: number; title: string; type: WorkflowPlanStepType }>;
  decisionIds: string[];
  insightIds: string[];
  contextSources: string[];
  evidenceRefs: Array<{ id: string; label: string }>;
  requestedByUserId: string;
  tenantId: string;
  expiresAt: string;
  approvalReason: string;
}

export interface WorkflowPlanHandoffResult {
  planId: string;
  status: WorkflowPlanStatus;
  workflowId: string;
  workflowExecutionId: string;
  handedOffAt: string;
  /** True when a prior handoff already produced this identifier. */
  idempotentReplay: boolean;
}

/** User-safe streaming progress. Never carries model reasoning. */
export type WorkflowPlanStreamEvent =
  | { type: 'plan_started'; objective: string }
  | { type: 'source_loaded'; source: 'decisions'; decisionsConsidered: number }
  | { type: 'step_generated'; planKey: string; order: number; title: string }
  | { type: 'approval_submitted'; planId: string; approvalId: string; status: WorkflowPlanStatus }
  | { type: 'plan_completed'; result: WorkflowPlansResult }
  | { type: 'plan_failed'; code: string; message: string };
