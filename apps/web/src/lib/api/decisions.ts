import { apiClient } from "./client";

export type DecisionPriority = "critical" | "high" | "medium" | "low";
export type DecisionConfidence = "high" | "medium" | "low";
export type DecisionUrgency = "immediate" | "this_week" | "this_month" | "monitor";

export type DecisionCategory =
  | "sales"
  | "finance"
  | "operations"
  | "communications"
  | "customer_success"
  | "risk"
  | "executive_priority"
  | "compliance";

export type DecisionEvidence = {
  id: string;
  label: string;
  priority: DecisionPriority;
  occurredAt?: string;
  amount?: number;
  details?: Record<string, string | number | boolean | null>;
};

export type DecisionExplainability = {
  ruleId: string;
  ruleVersion: string;
  insightIdsUsed: string[];
  contextSourcesUsed: string[];
  excludedSources: Array<{ source: string; reason: string }>;
  priorityReason: string;
  confidenceReason: string;
  riskReason: string;
  permissionLimitations: string[];
};

export type Decision = {
  id: string;
  category: DecisionCategory;
  title: string;
  summary: string;
  priority: DecisionPriority;
  confidence: DecisionConfidence;
  businessImpact: DecisionPriority;
  urgency: DecisionUrgency;
  riskLevel: DecisionPriority;
  evidence: DecisionEvidence[];
  supportingMetrics: Record<string, number>;
  requiredPermissions: string[];
  recommendedAction: {
    code: string;
    label: string;
    type: string;
    requiresApproval: boolean;
    executes: false;
  };
  approvalRequired: boolean;
  generatedAt: string;
  insightIdsUsed: string[];
  contextSourcesUsed: string[];
  excludedSources: Array<{ source: string; reason: string }>;
  explainability: DecisionExplainability;
};

export type DecisionsResult = {
  decisionVersion: string;
  generatedAt: string;
  tenantId: string;
  userId: string;
  decisions: Decision[];
  excludedSources: Array<{ source: string; reason: string }>;
  insightsConsidered: number;
  rulesEvaluated: string[];
  priorityDistribution: Record<DecisionPriority, number>;
  approvalRequiredCount: number;
};

export const decisionsApi = {
  get: (signal?: AbortSignal) =>
    apiClient.get<DecisionsResult>("/ai/decisions", { signal }),
};
