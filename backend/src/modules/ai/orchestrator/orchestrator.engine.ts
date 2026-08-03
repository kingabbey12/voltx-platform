import { Injectable } from '@nestjs/common';
import { ExecutiveContextItem, ExecutiveContextSource } from '../context/context.types';
import { OrchestratorMetrics } from './orchestrator.metrics';
import {
  AGENT_MAX_ATTEMPTS,
  AGENT_TIMEOUT_MS,
  OrchestratorCircuitBreaker,
} from './orchestrator.policy';
import { OrchestratorRegistry } from './orchestrator.registry';
import {
  AgentAssessment,
  AgentConfidence,
  AgentInterface,
  AgentPriority,
  AgentRecommendation,
  AgentResult,
  AgentRunInput,
  ConflictType,
  ExcludedRecommendation,
  OrchestrationConflict,
  OrchestrationConsensus,
  RejectedRecommendation,
} from './orchestrator.types';

const PRIORITY_WEIGHT: Record<AgentPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const CONFIDENCE_WEIGHT: Record<AgentConfidence, number> = { high: 3, medium: 2, low: 1 };

/** Evidence carried on the merged result. */
const MAX_MERGED_EVIDENCE = 20;

export class AgentTimeoutError extends Error {
  constructor(agentId: string) {
    super(`Agent ${agentId} exceeded the ${AGENT_TIMEOUT_MS}ms execution budget.`);
    this.name = 'AgentTimeoutError';
  }
}

export class OrchestrationCancelledError extends Error {
  constructor() {
    super('Orchestration was cancelled by the client.');
    this.name = 'OrchestrationCancelledError';
  }
}

export interface MergeOutcome {
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
}

@Injectable()
export class OrchestratorEngine {
  constructor(
    private readonly registry: OrchestratorRegistry,
    private readonly breaker: OrchestratorCircuitBreaker,
    private readonly metrics: OrchestratorMetrics,
  ) {}

  /**
   * Runs one agent under the shared execution policy: circuit breaker,
   * bounded attempts, and a hard timeout. Never throws — a failure becomes
   * a non-succeeded AgentResult so the orchestration can continue and the
   * failure stays visible in the response.
   */
  async execute(
    agent: AgentInterface,
    input: AgentRunInput,
    signal?: AbortSignal,
  ): Promise<AgentResult> {
    const startedAt = performance.now();
    const base = {
      agentId: agent.id,
      agentName: agent.name,
      agentVersion: agent.version,
      mode: agent.mode,
      capabilities: [...agent.supportedCapabilities],
      excludedSources: input.decisions.excludedSources,
    };

    if (this.breaker.isOpen(agent.id)) {
      const result = this.emptyResult(base, 'circuit_open', 0, 0);
      result.failureReason = 'The circuit breaker for this agent is open after repeated failures.';
      this.metrics.recordAgentExecution(agent.id, 'circuit_open', 0);
      return result;
    }

    let attempts = 0;
    let lastError: unknown;
    while (attempts < AGENT_MAX_ATTEMPTS) {
      if (signal?.aborted) throw new OrchestrationCancelledError();
      attempts += 1;
      if (attempts > 1) this.metrics.recordRetry(agent.id);
      try {
        const output = await this.withTimeout(agent, input, signal);
        const executionMs = performance.now() - startedAt;
        this.breaker.recordSuccess(agent.id);
        this.metrics.recordAgentExecution(agent.id, 'succeeded', executionMs);
        this.metrics.recordConfidence(output.confidence);
        return {
          ...base,
          ...output,
          status: 'succeeded',
          approvalRequired: output.recommendations.some(
            (recommendation) => recommendation.requiresApproval,
          ),
          executionMs,
          attempts,
        };
      } catch (error) {
        if (error instanceof OrchestrationCancelledError) throw error;
        lastError = error;
        if (error instanceof AgentTimeoutError) break;
      }
    }

    const executionMs = performance.now() - startedAt;
    const timedOut = lastError instanceof AgentTimeoutError;
    const status = timedOut ? 'timed_out' : 'failed';
    if (timedOut) this.metrics.recordTimeout(agent.id);
    if (this.breaker.recordFailure(agent.id)) this.metrics.recordCircuitOpen(agent.id);
    this.metrics.recordAgentExecution(agent.id, status, executionMs);

    const result = this.emptyResult(base, status, executionMs, attempts);
    result.failureReason = timedOut
      ? `Agent exceeded the ${AGENT_TIMEOUT_MS}ms budget after ${attempts} attempt(s).`
      : `Agent failed after ${attempts} attempt(s): ${
          lastError instanceof Error ? lastError.message : 'unknown error'
        }`;
    return result;
  }

  private async withTimeout(agent: AgentInterface, input: AgentRunInput, signal?: AbortSignal) {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        agent.run(input),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new AgentTimeoutError(agent.id)), AGENT_TIMEOUT_MS);
          signal?.addEventListener('abort', () => reject(new OrchestrationCancelledError()), {
            once: true,
          });
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private emptyResult(
    base: Omit<AgentResult, keyof ReturnType<OrchestratorEngine['emptyShape']>>,
    status: AgentResult['status'],
    executionMs: number,
    attempts: number,
  ): AgentResult {
    return { ...base, ...this.emptyShape(), status, executionMs, attempts };
  }

  private emptyShape() {
    return {
      summary: '',
      assessments: [] as AgentAssessment[],
      recommendations: [] as AgentRecommendation[],
      evidence: [] as ExecutiveContextItem[],
      decisionIds: [] as string[],
      insightIds: [] as string[],
      confidence: 'low' as AgentConfidence,
      businessImpact: 'low' as AgentPriority,
      priority: 'low' as AgentPriority,
      sourcesUsed: [] as ExecutiveContextSource[],
      approvalRequired: false,
      status: 'failed' as AgentResult['status'],
      executionMs: 0,
      attempts: 0,
    };
  }

  /**
   * Deterministic merge. Agent results are folded in registry-precedence
   * order, so the same inputs always produce the same recommendation set,
   * the same conflict list and the same consensus.
   */
  merge(
    results: readonly AgentResult[],
    permissions: readonly string[],
    skipped: OrchestrationConsensus['skippedAgents'],
  ): MergeOutcome {
    const succeeded = [...results]
      .filter((result) => result.status === 'succeeded')
      .sort(
        (left, right) =>
          this.registry.precedenceOf(left.agentId) - this.registry.precedenceOf(right.agentId),
      );

    const conflicts = this.detectConflicts(succeeded);
    const winners = new Map<string, string>();
    for (const conflict of conflicts) {
      if (conflict.type === 'recommendation')
        winners.set(conflict.decisionId, conflict.resolvedInFavourOf);
    }

    const held = new Set(permissions);
    const recommendations: AgentRecommendation[] = [];
    const rejected: RejectedRecommendation[] = [];
    const excluded: ExcludedRecommendation[] = [];
    const seen = new Set<string>();

    for (const result of succeeded) {
      for (const recommendation of result.recommendations) {
        const winner = winners.get(recommendation.decisionId);
        if (winner && winner !== result.agentId) {
          rejected.push({
            agentId: result.agentId,
            decisionId: recommendation.decisionId,
            code: recommendation.code,
            reason: `Superseded by ${winner}, which holds higher registry precedence for this decision.`,
          });
          continue;
        }
        const missing = recommendation.requiredPermissions.filter(
          (permission) => !held.has(permission),
        );
        if (missing.length > 0) {
          excluded.push({
            agentId: result.agentId,
            decisionId: recommendation.decisionId,
            code: recommendation.code,
            reason: 'The role cannot carry out this recommendation.',
            missingPermissions: [...missing].sort(),
          });
          continue;
        }
        const key = `${recommendation.decisionId}:${recommendation.code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recommendations.push(recommendation);
      }
    }

    recommendations.sort(
      (left, right) =>
        left.decisionId.localeCompare(right.decisionId) || left.code.localeCompare(right.code),
    );

    const evidence = this.mergeEvidence(succeeded);
    const consensus = this.consensus(succeeded, results, skipped, rejected, excluded, conflicts);

    return {
      recommendations,
      evidence,
      decisionIds: [...new Set(succeeded.flatMap((result) => result.decisionIds))].sort(),
      insightIds: [...new Set(succeeded.flatMap((result) => result.insightIds))].sort(),
      conflicts,
      consensus,
      priority: succeeded.reduce<AgentPriority>(
        (highest, result) =>
          PRIORITY_WEIGHT[result.priority] > PRIORITY_WEIGHT[highest] ? result.priority : highest,
        'low',
      ),
      businessImpact: succeeded.reduce<AgentPriority>(
        (highest, result) =>
          PRIORITY_WEIGHT[result.businessImpact] > PRIORITY_WEIGHT[highest]
            ? result.businessImpact
            : highest,
        'low',
      ),
      confidence:
        succeeded.length === 0
          ? 'low'
          : succeeded.reduce<AgentConfidence>(
              (lowest, result) =>
                CONFIDENCE_WEIGHT[result.confidence] < CONFIDENCE_WEIGHT[lowest]
                  ? result.confidence
                  : lowest,
              'high',
            ),
      approvalRequired: recommendations.some((recommendation) => recommendation.requiresApproval),
      sourcesUsed: [...new Set(succeeded.flatMap((result) => result.sourcesUsed))].sort(),
    };
  }

  private mergeEvidence(results: readonly AgentResult[]): ExecutiveContextItem[] {
    const unique = new Map<string, ExecutiveContextItem>();
    for (const result of results) {
      for (const item of result.evidence) if (!unique.has(item.id)) unique.set(item.id, item);
    }
    return [...unique.values()]
      .sort(
        (left, right) =>
          PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
          left.id.localeCompare(right.id),
      )
      .slice(0, MAX_MERGED_EVIDENCE);
  }

  /**
   * Pairwise comparison of every assessment two agents made of the same
   * decision. Conflicts are reported, never resolved by dropping one side:
   * the merge keeps the higher-precedence agent's recommendation and the
   * loser is listed in `rejectedRecommendations`.
   */
  private detectConflicts(results: readonly AgentResult[]): OrchestrationConflict[] {
    const byDecision = new Map<string, Array<{ agentId: string; assessment: AgentAssessment }>>();
    for (const result of results) {
      for (const assessment of result.assessments) {
        const bucket = byDecision.get(assessment.decisionId) ?? [];
        bucket.push({ agentId: result.agentId, assessment });
        byDecision.set(assessment.decisionId, bucket);
      }
    }

    const conflicts: OrchestrationConflict[] = [];
    for (const decisionId of [...byDecision.keys()].sort()) {
      const entries = byDecision
        .get(decisionId)!
        .sort(
          (left, right) =>
            this.registry.precedenceOf(left.agentId) - this.registry.precedenceOf(right.agentId),
        );
      if (entries.length < 2) continue;
      const [owner, ...others] = entries;

      const checks: Array<{
        type: ConflictType;
        differs: (a: AgentAssessment, b: AgentAssessment) => boolean;
        detail: (a: AgentAssessment, b: AgentAssessment, ids: string[]) => string;
      }> = [
        {
          type: 'priority',
          differs: (a, b) => a.priority !== b.priority,
          detail: (a, b, ids) =>
            `${ids[0]} assessed priority ${a.priority}; ${ids[1]} assessed ${b.priority}.`,
        },
        {
          type: 'recommendation',
          differs: (a, b) => a.recommendationCode !== b.recommendationCode,
          detail: (a, b, ids) =>
            `${ids[0]} recommends ${a.recommendationCode}; ${ids[1]} recommends ${b.recommendationCode}.`,
        },
        {
          type: 'confidence',
          differs: (a, b) => a.confidence !== b.confidence,
          detail: (a, b, ids) =>
            `${ids[0]} reports ${a.confidence} confidence; ${ids[1]} reports ${b.confidence}.`,
        },
        {
          type: 'evidence',
          differs: (a, b) => a.evidenceIds.join('|') !== b.evidenceIds.join('|'),
          detail: (a, b, ids) =>
            `${ids[0]} cites ${a.evidenceIds.length} record(s); ${ids[1]} cites ${b.evidenceIds.length}.`,
        },
        {
          type: 'permissions',
          differs: (a, b) => a.requiredPermissions.join('|') !== b.requiredPermissions.join('|'),
          detail: (a, b, ids) =>
            `${ids[0]} requires ${a.requiredPermissions.join(', ') || 'none'}; ${ids[1]} requires ${
              b.requiredPermissions.join(', ') || 'none'
            }.`,
        },
        {
          type: 'affected_module',
          differs: (a, b) => a.affectedModule !== b.affectedModule,
          detail: (a, b, ids) =>
            `${ids[0]} attributes this to ${a.affectedModule}; ${ids[1]} attributes it to ${b.affectedModule}.`,
        },
      ];

      for (const other of others) {
        for (const check of checks) {
          if (!check.differs(owner.assessment, other.assessment)) continue;
          conflicts.push({
            id: `${decisionId}:${check.type}:${owner.agentId}:${other.agentId}`,
            type: check.type,
            decisionId,
            agentIds: [owner.agentId, other.agentId],
            detail: check.detail(owner.assessment, other.assessment, [
              owner.agentId,
              other.agentId,
            ]),
            resolvedInFavourOf: owner.agentId,
            resolutionReason: `${owner.agentId} holds higher registry precedence than ${other.agentId}.`,
          });
        }
      }
    }

    return conflicts.sort((left, right) => left.id.localeCompare(right.id));
  }

  /**
   * Agreement score = share of contested decisions on which every
   * assessing agent reported the same priority and the same recommendation.
   * A decision only one agent assessed is not contested and is excluded
   * from the denominator; with no contested decisions the score is 1 and
   * `sharedAssessments` is 0, which the explanation states plainly.
   */
  private consensus(
    succeeded: readonly AgentResult[],
    all: readonly AgentResult[],
    skipped: OrchestrationConsensus['skippedAgents'],
    rejected: RejectedRecommendation[],
    excluded: ExcludedRecommendation[],
    conflicts: readonly OrchestrationConflict[],
  ): OrchestrationConsensus {
    const byDecision = new Map<string, AgentAssessment[]>();
    for (const result of succeeded) {
      for (const assessment of result.assessments) {
        byDecision.set(assessment.decisionId, [
          ...(byDecision.get(assessment.decisionId) ?? []),
          assessment,
        ]);
      }
    }

    let shared = 0;
    let agreed = 0;
    for (const assessments of byDecision.values()) {
      if (assessments.length < 2) continue;
      shared += 1;
      const [first] = assessments;
      const unanimous = assessments.every(
        (assessment) =>
          assessment.priority === first.priority &&
          assessment.recommendationCode === first.recommendationCode,
      );
      if (unanimous) agreed += 1;
    }

    const agreementScore = shared === 0 ? 1 : Number((agreed / shared).toFixed(4));
    const confidenceDistribution: Record<AgentConfidence, number> = { high: 0, medium: 0, low: 0 };
    for (const result of succeeded) confidenceDistribution[result.confidence] += 1;

    const failed = all
      .filter(
        (result) =>
          result.status === 'failed' ||
          result.status === 'timed_out' ||
          result.status === 'circuit_open',
      )
      .map((result) => ({
        agentId: result.agentId,
        status: result.status,
        reason: result.failureReason ?? 'Agent did not complete.',
      }));

    return {
      agreementScore,
      sharedAssessments: shared,
      agreedAssessments: agreed,
      confidenceDistribution,
      participatingAgents: succeeded.map((result) => result.agentId).sort(),
      skippedAgents: [...skipped].sort((left, right) => left.agentId.localeCompare(right.agentId)),
      failedAgents: failed.sort((left, right) => left.agentId.localeCompare(right.agentId)),
      rejectedRecommendations: rejected.sort(
        (left, right) =>
          left.decisionId.localeCompare(right.decisionId) ||
          left.agentId.localeCompare(right.agentId),
      ),
      excludedRecommendations: excluded.sort(
        (left, right) =>
          left.decisionId.localeCompare(right.decisionId) ||
          left.agentId.localeCompare(right.agentId),
      ),
      explanation:
        shared === 0
          ? `No decision was assessed by more than one agent, so there was nothing to disagree about; ${succeeded.length} agent(s) participated and ${conflicts.length} conflict(s) were detected.`
          : `${agreed} of ${shared} decision(s) assessed by two or more agents drew identical priority and recommendation; ${conflicts.length} conflict(s) are listed in full.`,
    };
  }
}
