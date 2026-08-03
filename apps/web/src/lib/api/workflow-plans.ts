import { apiClient } from "./client";
import type { DecisionCategory, DecisionPriority } from "./decisions";

export type WorkflowPlanStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "handed_off";

export type WorkflowPlanStepType = "review" | "draft" | "notify" | "suggest_approval";

export type WorkflowPlanStep = {
  order: number;
  key: string;
  title: string;
  type: WorkflowPlanStepType;
  decisionId: string;
  requiredPermissions: string[];
  estimatedMinutes: number;
};

export type WorkflowPlanEvidenceRef = {
  id: string;
  label: string;
  priority: DecisionPriority;
  decisionId: string;
};

export type WorkflowPlanBody = {
  id: string;
  planKey: string;
  version: string;
  category: DecisionCategory;
  title: string;
  summary: string;
  objective: string;
  priority: DecisionPriority;
  urgency: string;
  businessImpact: string;
  confidence: "high" | "medium" | "low";
  risk: DecisionPriority;
  decisionIds: string[];
  insightIds: string[];
  contextSources: string[];
  evidence: WorkflowPlanEvidenceRef[];
  steps: WorkflowPlanStep[];
  estimatedDurationMinutes: number;
  requiredRoles: string[];
  requiredPermissions: string[];
  approvalRequired: true;
  explainability: {
    ruleId: string;
    ruleVersion: string;
    excludedSources: Array<{ source: string; reason: string }>;
    priorityReason: string;
    confidenceReason: string;
    riskReason: string;
    approvalReason: string;
    permissionLimitations: string[];
  };
};

export type WorkflowPlan = {
  id: string;
  tenantId: string;
  userId: string;
  planKey: string;
  planVersion: string;
  plan: WorkflowPlanBody;
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
};

export type WorkflowPlansResult = {
  planSetVersion: string;
  generatedAt: string;
  tenantId: string;
  userId: string;
  plans: WorkflowPlan[];
  excludedSources: Array<{ source: string; reason: string }>;
  decisionsConsidered: number;
  plansGenerated: number;
};

export type WorkflowPlanHandoffResult = {
  planId: string;
  status: WorkflowPlanStatus;
  workflowId: string;
  workflowExecutionId: string;
  handedOffAt: string;
  idempotentReplay: boolean;
};

export const workflowPlansApi = {
  list: (signal?: AbortSignal) => apiClient.get<WorkflowPlan[]>("/ai/workflow-plans", { signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<WorkflowPlan>(`/ai/workflow-plans/${id}`, { signal }),
  generate: (objective?: string) =>
    apiClient.post<WorkflowPlansResult>("/ai/workflow-plans/generate", { objective }),
  submit: (id: string) => apiClient.post<WorkflowPlan>(`/ai/workflow-plans/${id}/submit`),
  cancel: (id: string) => apiClient.post<WorkflowPlan>(`/ai/workflow-plans/${id}/cancel`),
  handOff: (id: string, planVersion: string) =>
    apiClient.post<WorkflowPlanHandoffResult>(`/ai/workflow-plans/${id}/handoff`, { planVersion }),
};
