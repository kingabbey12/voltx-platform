import {
  ExecutiveContext,
  ExecutiveContextItem,
  ExecutiveContextSource,
} from '../context/context.types';
import { ExecutiveDecisionsResult } from '../decision/decision.types';
import { ExecutiveInsightsResult } from '../insights/insights.types';

export type AgentCapability =
  | 'executive_summary'
  | 'pipeline_analysis'
  | 'revenue_analysis'
  | 'budget_analysis'
  | 'operations_analysis'
  | 'communications_analysis'
  | 'customer_health_analysis'
  | 'compliance_review'
  | 'action_planning';

export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';
export type AgentConfidence = 'high' | 'medium' | 'low';

export type AgentExecutionMode = 'parallel' | 'sequential';

export type AgentExecutionStatus =
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'skipped_permission'
  | 'skipped_no_context'
  | 'circuit_open';

/**
 * A recommendation an agent surfaces. `executes` is structurally `false`
 * for the same reason as the Decision Engine's: an agent has no execution
 * path, and the type says so rather than a convention no one can check.
 */
export interface AgentRecommendation {
  code: string;
  label: string;
  decisionId: string;
  requiredPermissions: string[];
  requiresApproval: boolean;
  executes: false;
}

/** One agent's assessment of one decision — the unit conflicts compare. */
export interface AgentAssessment {
  decisionId: string;
  priority: AgentPriority;
  confidence: AgentConfidence;
  recommendationCode: string;
  affectedModule: ExecutiveContextSource | 'cross_domain';
  requiredPermissions: string[];
  evidenceIds: string[];
}

export interface AgentRunInput {
  objective: string;
  permissions: readonly string[];
  context: ExecutiveContext;
  insights: ExecutiveInsightsResult;
  decisions: ExecutiveDecisionsResult;
  /** Results of agents that already ran — populated for sequential agents. */
  upstream: readonly AgentResult[];
}

export interface AgentOutput {
  summary: string;
  assessments: AgentAssessment[];
  recommendations: AgentRecommendation[];
  evidence: ExecutiveContextItem[];
  decisionIds: string[];
  insightIds: string[];
  confidence: AgentConfidence;
  businessImpact: AgentPriority;
  priority: AgentPriority;
  sourcesUsed: ExecutiveContextSource[];
}

export interface AgentInterface {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedCapabilities: readonly AgentCapability[];
  readonly requiredPermissions: readonly string[];
  readonly supportedContextSources: readonly ExecutiveContextSource[];
  readonly mode: AgentExecutionMode;
  /**
   * Deterministic and pure. Async only so the executor can enforce a
   * uniform timeout, retry and circuit-breaker policy across every agent.
   */
  run(input: AgentRunInput): Promise<AgentOutput>;
}

export interface AgentResult extends AgentOutput {
  agentId: string;
  agentName: string;
  agentVersion: string;
  status: AgentExecutionStatus;
  mode: AgentExecutionMode;
  capabilities: AgentCapability[];
  approvalRequired: boolean;
  executionMs: number;
  attempts: number;
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  /** Present only for non-succeeded results. Never silently dropped. */
  failureReason?: string;
}

export type ConflictType =
  'priority' | 'recommendation' | 'confidence' | 'evidence' | 'permissions' | 'affected_module';

export interface OrchestrationConflict {
  id: string;
  type: ConflictType;
  decisionId: string;
  agentIds: string[];
  detail: string;
  /** The agent whose assessment the merge kept, by registry precedence. */
  resolvedInFavourOf: string;
  resolutionReason: string;
}

export interface RejectedRecommendation {
  agentId: string;
  decisionId: string;
  code: string;
  reason: string;
}

export interface ExcludedRecommendation {
  agentId: string;
  decisionId: string;
  code: string;
  reason: string;
  missingPermissions: string[];
}

export interface OrchestrationConsensus {
  /** Share of contested decisions on which every assessing agent agreed. */
  agreementScore: number;
  sharedAssessments: number;
  agreedAssessments: number;
  confidenceDistribution: Record<AgentConfidence, number>;
  participatingAgents: string[];
  skippedAgents: Array<{ agentId: string; status: AgentExecutionStatus; reason: string }>;
  failedAgents: Array<{ agentId: string; status: AgentExecutionStatus; reason: string }>;
  rejectedRecommendations: RejectedRecommendation[];
  excludedRecommendations: ExcludedRecommendation[];
  /** How the score was computed, in words. */
  explanation: string;
}

export interface OrchestrationResult {
  orchestrationVersion: '1.0';
  generatedAt: string;
  tenantId: string;
  userId: string;
  objective: string;
  routing: {
    capabilities: AgentCapability[];
    selectedAgentIds: string[];
    parallelAgentIds: string[];
    sequentialAgentIds: string[];
    matchedTerms: string[];
    rule: string;
  };
  agents: AgentResult[];
  recommendations: AgentRecommendation[];
  evidence: ExecutiveContextItem[];
  decisionIds: string[];
  insightIds: string[];
  conflicts: OrchestrationConflict[];
  consensus: OrchestrationConsensus;
  priority: AgentPriority;
  businessImpact: AgentPriority;
  confidence: AgentConfidence;
  approvalRequired: boolean;
  sourcesUsed: ExecutiveContextSource[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  executionMs: number;
  mergeMs: number;
  partialFailure: boolean;
}

/** Additive SSE events for the orchestrator's streaming endpoint. */
export type OrchestratorStreamEvent =
  | { type: 'orchestration_started'; objective: string; selectedAgentIds: string[] }
  | { type: 'orchestration_routing'; capabilities: AgentCapability[]; rule: string }
  | { type: 'orchestration_agent_started'; agentId: string; mode: AgentExecutionMode }
  | {
      type: 'orchestration_agent_finished';
      agentId: string;
      status: AgentExecutionStatus;
      executionMs: number;
    }
  | { type: 'orchestration_merged'; conflictCount: number; agreementScore: number }
  | { type: 'orchestration_finished'; result: OrchestrationResult };
