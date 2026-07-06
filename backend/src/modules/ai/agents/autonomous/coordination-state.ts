export interface CoordinationLimits {
  maxAgents: number;
  maxDepth: number;
  maxParallelExecutions: number;
  timeoutMs: number;
}

export type CoordinationLimitReason = 'max_agents' | 'max_depth' | 'timeout';

export class CoordinationLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly reason: CoordinationLimitReason,
  ) {
    super(message);
    this.name = 'CoordinationLimitExceededError';
  }
}

/**
 * Shared, by-reference state for one coordinator run's whole delegation
 * tree. Passed down through recursive delegation calls rather than
 * recomputed or duplicated per node, so a single agent-count/deadline
 * budget is enforced across the entire tree, not per branch.
 */
export interface CoordinationState {
  readonly rootRunId: string;
  readonly limits: CoordinationLimits;
  readonly deadlineAt: number;
  agentCount: number;
}

export function createCoordinationState(
  rootRunId: string,
  limits: CoordinationLimits,
): CoordinationState {
  return {
    rootRunId,
    limits,
    deadlineAt: Date.now() + limits.timeoutMs,
    agentCount: 1,
  };
}

export function isCoordinationDeadlineExceeded(state: CoordinationState): boolean {
  return Date.now() >= state.deadlineAt;
}

/**
 * Validates and reserves capacity for spawning one more agent at the given
 * depth, throwing CoordinationLimitExceededError if any limit would be
 * violated. Call before creating the child AgentRun so a rejected spawn
 * never partially consumes the budget.
 */
export function assertCanSpawnAgent(state: CoordinationState, nextDepth: number): void {
  if (isCoordinationDeadlineExceeded(state)) {
    throw new CoordinationLimitExceededError('Multi-agent coordination timed out', 'timeout');
  }

  if (nextDepth > state.limits.maxDepth) {
    throw new CoordinationLimitExceededError(
      `Maximum delegation depth (${state.limits.maxDepth}) exceeded`,
      'max_depth',
    );
  }

  if (state.agentCount >= state.limits.maxAgents) {
    throw new CoordinationLimitExceededError(
      `Maximum agent count (${state.limits.maxAgents}) exceeded for this coordination`,
      'max_agents',
    );
  }
}

export function registerSpawnedAgent(state: CoordinationState): void {
  state.agentCount += 1;
}
