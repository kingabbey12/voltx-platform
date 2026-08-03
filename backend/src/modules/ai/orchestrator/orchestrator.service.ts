import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ExecutiveContextService } from '../context/context.service';
import { ExecutiveContext } from '../context/context.types';
import { ExecutiveDecisionsService } from '../decision/decision.service';
import { ExecutiveDecisionsResult } from '../decision/decision.types';
import { ExecutiveInsightsService } from '../insights/insights.service';
import { ExecutiveInsightsResult } from '../insights/insights.types';
import { OrchestratorEngine } from './orchestrator.engine';
import { OrchestratorMetrics } from './orchestrator.metrics';
import { OrchestratorPolicy } from './orchestrator.policy';
import {
  AgentResult,
  AgentRunInput,
  OrchestrationConsensus,
  OrchestrationResult,
  OrchestratorStreamEvent,
} from './orchestrator.types';

/** Objectives are untrusted user text; bound and strip control characters
 * before they reach a rule, a log line or a prompt. */
const MAX_OBJECTIVE_LENGTH = 2_000;

export function sanitizeObjective(objective: string): string {
  return Array.from(objective)
    .map((character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_OBJECTIVE_LENGTH);
}

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly contextService: ExecutiveContextService,
    private readonly insightsService: ExecutiveInsightsService,
    private readonly decisionsService: ExecutiveDecisionsService,
    private readonly policy: OrchestratorPolicy,
    private readonly engine: OrchestratorEngine,
    private readonly audit: AuditService,
    private readonly metrics: OrchestratorMetrics,
  ) {}

  /**
   * Full path used by the HTTP controller. Assembles the verified context,
   * insights and decisions once, then hands them to every agent — no agent
   * ever reaches past this boundary.
   */
  async orchestrate(
    objective: string,
    permissions: string[],
    signal?: AbortSignal,
  ): Promise<OrchestrationResult> {
    try {
      const [context, insights, decisions] = await this.assemble(permissions);
      return await this.run(objective, permissions, context, insights, decisions, signal);
    } catch (error) {
      this.metrics.recordRequest('failure');
      throw error;
    }
  }

  /** Used by the Executive Assistant, which already holds the three inputs. */
  async orchestrateFrom(
    objective: string,
    permissions: string[],
    context: ExecutiveContext,
    insights: ExecutiveInsightsResult,
    decisions: ExecutiveDecisionsResult,
    signal?: AbortSignal,
  ): Promise<OrchestrationResult> {
    try {
      return await this.run(objective, permissions, context, insights, decisions, signal);
    } catch (error) {
      this.metrics.recordRequest('failure');
      throw error;
    }
  }

  /** Streaming variant for the orchestrator's SSE endpoint. */
  async *stream(
    objective: string,
    permissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<OrchestratorStreamEvent, void> {
    const [context, insights, decisions] = await this.assemble(permissions);
    const safeObjective = sanitizeObjective(objective);
    const routing = this.policy.route(safeObjective);
    const { eligible } = this.policy.validate(routing.agents, permissions, context);

    yield {
      type: 'orchestration_started',
      objective: safeObjective,
      selectedAgentIds: eligible.map((agent) => agent.id),
    };
    yield {
      type: 'orchestration_routing',
      capabilities: routing.capabilities,
      rule: routing.rule,
    };
    for (const agent of eligible) {
      yield { type: 'orchestration_agent_started', agentId: agent.id, mode: agent.mode };
    }

    const result = await this.run(objective, permissions, context, insights, decisions, signal);
    for (const agentResult of result.agents) {
      yield {
        type: 'orchestration_agent_finished',
        agentId: agentResult.agentId,
        status: agentResult.status,
        executionMs: agentResult.executionMs,
      };
    }
    yield {
      type: 'orchestration_merged',
      conflictCount: result.conflicts.length,
      agreementScore: result.consensus.agreementScore,
    };
    yield { type: 'orchestration_finished', result };
  }

  private assemble(
    permissions: string[],
  ): Promise<[ExecutiveContext, ExecutiveInsightsResult, ExecutiveDecisionsResult]> {
    return Promise.all([
      this.contextService.getExecutiveContext({ permissions }),
      this.insightsService.generate(permissions),
      this.decisionsService.generate(permissions),
    ]);
  }

  private async run(
    rawObjective: string,
    permissions: string[],
    context: ExecutiveContext,
    insights: ExecutiveInsightsResult,
    decisions: ExecutiveDecisionsResult,
    signal?: AbortSignal,
  ): Promise<OrchestrationResult> {
    const startedAt = performance.now();
    const objective = sanitizeObjective(rawObjective);

    // Capability selection, then permission validation — in that order, so
    // a rejection is always attributable to a specific selected agent.
    const routing = this.policy.route(objective);
    const { eligible, rejected } = this.policy.validate(routing.agents, permissions, context);

    const skipped: OrchestrationConsensus['skippedAgents'] = rejected.map((entry) => ({
      agentId: entry.agent.id,
      status: entry.status,
      reason: entry.reason,
    }));

    const parallelAgents = eligible.filter((agent) => agent.mode === 'parallel');
    const sequentialAgents = eligible.filter((agent) => agent.mode === 'sequential');

    const baseInput: Omit<AgentRunInput, 'upstream'> = {
      objective,
      permissions,
      context,
      insights,
      decisions,
    };

    // Parallel phase. Promise.all is safe because execute() never rejects
    // except on cancellation, and results are re-sorted deterministically.
    const parallelResults = await Promise.all(
      parallelAgents.map((agent) =>
        this.engine.execute(agent, { ...baseInput, upstream: [] }, signal),
      ),
    );

    // Sequential phase — each agent sees every result produced so far,
    // which is the delegation edge in the execution graph.
    const sequentialResults: AgentResult[] = [];
    for (const agent of sequentialAgents) {
      sequentialResults.push(
        await this.engine.execute(
          agent,
          { ...baseInput, upstream: [...parallelResults, ...sequentialResults] },
          signal,
        ),
      );
    }

    const agents = [...parallelResults, ...sequentialResults].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    );

    const mergeStartedAt = performance.now();
    const merged = this.engine.merge(agents, permissions, skipped);
    const mergeMs = performance.now() - mergeStartedAt;
    const executionMs = performance.now() - startedAt;
    const partialFailure =
      agents.some((agent) => agent.status !== 'succeeded') || skipped.length > 0;

    const result: OrchestrationResult = {
      orchestrationVersion: '1.0',
      generatedAt: decisions.generatedAt,
      tenantId: decisions.tenantId,
      userId: decisions.userId,
      objective,
      routing: {
        capabilities: routing.capabilities,
        selectedAgentIds: routing.agents.map((agent) => agent.id).sort(),
        parallelAgentIds: parallelAgents.map((agent) => agent.id).sort(),
        sequentialAgentIds: sequentialAgents.map((agent) => agent.id).sort(),
        matchedTerms: routing.matchedTerms,
        rule: routing.rule,
      },
      agents,
      ...merged,
      excludedSources: decisions.excludedSources,
      executionMs,
      mergeMs,
      partialFailure,
    };

    await this.audit.record({
      action: 'orchestrate',
      resource: 'multi_agent_orchestration',
      resourceId: result.tenantId,
      metadata: {
        agentCount: agents.length,
        conflictCount: result.conflicts.length,
        agreementScore: result.consensus.agreementScore,
        approvalRequired: result.approvalRequired,
        partialFailure,
      },
    });

    this.metrics.recordRequest('success');
    this.metrics.recordDuration(executionMs);
    this.metrics.recordMergeDuration(mergeMs);
    this.metrics.recordExecutionMode('parallel', parallelResults.length);
    this.metrics.recordExecutionMode('sequential', sequentialResults.length);
    this.metrics.recordConsensus(result.consensus.agreementScore);
    for (const conflict of result.conflicts) this.metrics.recordConflict(conflict.type);
    if (partialFailure) this.metrics.recordPartialFailure();

    return result;
  }
}
