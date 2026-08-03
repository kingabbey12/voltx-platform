import { AgentActionApprovalStatus } from '@prisma/client';
import { DecisionCategory } from '../decision/decision.types';
import { WorkflowPlanStatus } from './workflow-engine.types';

export const AUTONOMOUS_WORKFLOW_PLAN_POLICY = {
  neverExecutes: true,
  approvalRequired: true,
  version: '1.0',
} as const;

export const PLAN_VERSION = '1.0';
export const PLAN_RULE_ID = 'workflow-plan-from-decision';

/** Plans returned by one generation. Bounds the response at volume. */
export const MAX_PLANS = 10;
/** Steps per plan. */
export const MAX_STEPS_PER_PLAN = 6;
/** Evidence references carried per plan. */
export const MAX_PLAN_EVIDENCE = 5;
/** How long a generated plan stays actionable before it expires. */
export const PLAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Categories a plan may be built for. `executive_priority` is a briefing
 * that changes nothing, so it is deliberately not planned — a plan always
 * describes work someone must approve.
 */
export const PLANNABLE_CATEGORIES: readonly DecisionCategory[] = [
  'sales',
  'finance',
  'operations',
  'communications',
  'customer_success',
  'risk',
  'compliance',
];

/** Which role is expected to approve a plan in each category. */
export const CATEGORY_ROLES: Record<DecisionCategory, string[]> = {
  sales: ['manager'],
  finance: ['admin'],
  operations: ['manager'],
  communications: ['manager'],
  customer_success: ['manager'],
  risk: ['admin', 'owner'],
  compliance: ['admin', 'owner'],
  executive_priority: ['manager'],
};

/** Per-step minute estimates, fixed so duration stays deterministic. */
export const STEP_MINUTES = { review: 10, draft: 15, notify: 5, suggest_approval: 5 } as const;

/**
 * The single mapping from the existing approval framework's states onto
 * the plan contract. `CANCELLED` was added to the shared enum for this;
 * nothing here can map onto an executed state.
 */
export function planStatusForApproval(
  status: AgentActionApprovalStatus,
): Extract<
  WorkflowPlanStatus,
  'awaiting_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired'
> {
  switch (status) {
    case 'PENDING':
      return 'awaiting_approval';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'expired';
  }
}

/** Statuses from which a plan may still be submitted for approval. */
export const SUBMITTABLE_STATUSES: readonly WorkflowPlanStatus[] = ['awaiting_approval'];

/** The only status a handoff may start from. */
export const HANDOFF_REQUIRED_STATUS: WorkflowPlanStatus = 'approved';
