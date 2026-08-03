import { apiClient } from "./client";
import type { DecisionEvidence, DecisionPriority } from "./decisions";

export type AgentConfidence = "high" | "medium" | "low";
export type AgentExecutionMode = "parallel" | "sequential";

export type AgentExecutionStatus =
  | "succeeded"
  | "failed"
  | "timed_out"
  | "skipped_permission"
  | "skipped_no_context"
  | "circuit_open";

export type ConflictType =
  | "priority"
  | "recommendation"
  | "confidence"
  | "evidence"
  | "permissions"
  | "affected_module";

export type AgentRecommendation = {
  code: string;
  label: string;
  decisionId: string;
  requiredPermissions: string[];
  requiresApproval: boolean;
  executes: false;
};

export type AgentAssessment = {
  decisionId: string;
  priority: DecisionPriority;
  confidence: AgentConfidence;
  recommendationCode: string;
  affectedModule: string;
  requiredPermissions: string[];
  evidenceIds: string[];
};

export type AgentResult = {
  agentId: string;
  agentName: string;
  agentVersion: string;
  status: AgentExecutionStatus;
  mode: AgentExecutionMode;
  capabilities: string[];
  summary: string;
  assessments: AgentAssessment[];
  recommendations: AgentRecommendation[];
  evidence: DecisionEvidence[];
  decisionIds: string[];
  insightIds: string[];
  confidence: AgentConfidence;
  businessImpact: DecisionPriority;
  priority: DecisionPriority;
  approvalRequired: boolean;
  executionMs: number;
  attempts: number;
  sourcesUsed: string[];
  excludedSources: Array<{ source: string; reason: string }>;
  failureReason?: string;
};

export type OrchestrationConflict = {
  id: string;
  type: ConflictType;
  decisionId: string;
  agentIds: string[];
  detail: string;
  resolvedInFavourOf: string;
  resolutionReason: string;
};

export type OrchestrationConsensus = {
  agreementScore: number;
  sharedAssessments: number;
  agreedAssessments: number;
  confidenceDistribution: Record<AgentConfidence, number>;
  participatingAgents: string[];
  skippedAgents: Array<{ agentId: string; status: AgentExecutionStatus; reason: string }>;
  failedAgents: Array<{ agentId: string; status: AgentExecutionStatus; reason: string }>;
  rejectedRecommendations: Array<{
    agentId: string;
    decisionId: string;
    code: string;
    reason: string;
  }>;
  excludedRecommendations: Array<{
    agentId: string;
    decisionId: string;
    code: string;
    reason: string;
    missingPermissions: string[];
  }>;
  explanation: string;
};

export type OrchestrationResult = {
  orchestrationVersion: string;
  generatedAt: string;
  tenantId: string;
  userId: string;
  objective: string;
  routing: {
    capabilities: string[];
    selectedAgentIds: string[];
    parallelAgentIds: string[];
    sequentialAgentIds: string[];
    matchedTerms: string[];
    rule: string;
  };
  agents: AgentResult[];
  recommendations: AgentRecommendation[];
  evidence: DecisionEvidence[];
  decisionIds: string[];
  insightIds: string[];
  conflicts: OrchestrationConflict[];
  consensus: OrchestrationConsensus;
  priority: DecisionPriority;
  businessImpact: DecisionPriority;
  confidence: AgentConfidence;
  approvalRequired: boolean;
  sourcesUsed: string[];
  excludedSources: Array<{ source: string; reason: string }>;
  executionMs: number;
  mergeMs: number;
  partialFailure: boolean;
};

export const DEFAULT_OBJECTIVE = "Review the entire business.";

export const orchestratorApi = {
  run: (objective: string, signal?: AbortSignal) =>
    apiClient.post<OrchestrationResult>(
      "/ai/orchestrator/run",
      { objective },
      { signal },
    ),
};
