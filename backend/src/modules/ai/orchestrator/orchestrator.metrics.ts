import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { MetricsService } from '../../metrics/metrics.service';
import { AgentConfidence, AgentExecutionStatus, AgentExecutionMode } from './orchestrator.types';

/**
 * Orchestrator metrics live on the shared registry so `/metrics` stays a
 * single scrape target. Every label is drawn from a closed union — agent
 * ids come from the static registry, statuses and modes from their type
 * unions, and the consensus bucket from a fixed five-value scale — so no
 * tenant, user, objective or record value can ever become a label.
 */
@Injectable()
export class OrchestratorMetrics {
  private readonly requests: Counter<'result'>;
  private readonly duration: Histogram<string>;
  private readonly agentExecutions: Counter<'agent' | 'status'>;
  private readonly agentDuration: Histogram<'agent'>;
  private readonly executionsByMode: Counter<'mode'>;
  private readonly consensusBuckets: Counter<'bucket'>;
  private readonly conflicts: Counter<'type'>;
  private readonly mergeDuration: Histogram<string>;
  private readonly partialFailures: Counter<string>;
  private readonly timeouts: Counter<'agent'>;
  private readonly retries: Counter<'agent'>;
  private readonly circuitOpenings: Counter<'agent'>;
  private readonly confidence: Counter<'confidence'>;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    this.requests = new Counter({
      name: 'voltx_orchestrator_requests_total',
      help: 'Multi-agent orchestration requests by result',
      labelNames: ['result'] as const,
      registers,
    });
    this.duration = new Histogram({
      name: 'voltx_orchestrator_duration_seconds',
      help: 'End-to-end multi-agent orchestration duration in seconds',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers,
    });
    this.agentExecutions = new Counter({
      name: 'voltx_orchestrator_agent_executions_total',
      help: 'Agent executions by agent and terminal status',
      labelNames: ['agent', 'status'] as const,
      registers,
    });
    this.agentDuration = new Histogram({
      name: 'voltx_orchestrator_agent_duration_seconds',
      help: 'Individual agent execution duration in seconds',
      labelNames: ['agent'] as const,
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers,
    });
    this.executionsByMode = new Counter({
      name: 'voltx_orchestrator_executions_by_mode_total',
      help: 'Agent executions by execution mode',
      labelNames: ['mode'] as const,
      registers,
    });
    this.consensusBuckets = new Counter({
      name: 'voltx_orchestrator_consensus_total',
      help: 'Orchestrations by agreement-score bucket',
      labelNames: ['bucket'] as const,
      registers,
    });
    this.conflicts = new Counter({
      name: 'voltx_orchestrator_conflicts_total',
      help: 'Detected inter-agent conflicts by type',
      labelNames: ['type'] as const,
      registers,
    });
    this.mergeDuration = new Histogram({
      name: 'voltx_orchestrator_merge_duration_seconds',
      help: 'Result merge duration in seconds',
      buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers,
    });
    this.partialFailures = new Counter({
      name: 'voltx_orchestrator_partial_failures_total',
      help: 'Orchestrations completing with at least one non-succeeded agent',
      registers,
    });
    this.timeouts = new Counter({
      name: 'voltx_orchestrator_agent_timeouts_total',
      help: 'Agent executions abandoned at the timeout',
      labelNames: ['agent'] as const,
      registers,
    });
    this.retries = new Counter({
      name: 'voltx_orchestrator_agent_retries_total',
      help: 'Agent execution retry attempts',
      labelNames: ['agent'] as const,
      registers,
    });
    this.circuitOpenings = new Counter({
      name: 'voltx_orchestrator_circuit_open_total',
      help: 'Circuit breaker openings by agent',
      labelNames: ['agent'] as const,
      registers,
    });
    this.confidence = new Counter({
      name: 'voltx_orchestrator_agent_confidence_total',
      help: 'Agent result confidence distribution',
      labelNames: ['confidence'] as const,
      registers,
    });
  }

  recordRequest(result: 'success' | 'failure'): void {
    this.requests.inc({ result });
  }

  recordDuration(durationMs: number): void {
    this.duration.observe(durationMs / 1000);
  }

  recordAgentExecution(agent: string, status: AgentExecutionStatus, durationMs: number): void {
    this.agentExecutions.inc({ agent, status });
    this.agentDuration.observe({ agent }, durationMs / 1000);
  }

  recordExecutionMode(mode: AgentExecutionMode, count: number): void {
    if (count > 0) this.executionsByMode.inc({ mode }, count);
  }

  /** Buckets the [0,1] score into five fixed labels. */
  recordConsensus(score: number): void {
    const bucket =
      score >= 1
        ? '1.0'
        : score >= 0.75
          ? '0.75'
          : score >= 0.5
            ? '0.5'
            : score >= 0.25
              ? '0.25'
              : '0.0';
    this.consensusBuckets.inc({ bucket });
  }

  recordConflict(type: string): void {
    this.conflicts.inc({ type });
  }

  recordMergeDuration(durationMs: number): void {
    this.mergeDuration.observe(durationMs / 1000);
  }

  recordPartialFailure(): void {
    this.partialFailures.inc();
  }

  recordTimeout(agent: string): void {
    this.timeouts.inc({ agent });
  }

  recordRetry(agent: string): void {
    this.retries.inc({ agent });
  }

  recordCircuitOpen(agent: string): void {
    this.circuitOpenings.inc({ agent });
  }

  recordConfidence(confidence: AgentConfidence): void {
    this.confidence.inc({ confidence });
  }
}
