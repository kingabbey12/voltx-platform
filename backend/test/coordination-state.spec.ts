import {
  assertCanSpawnAgent,
  CoordinationLimitExceededError,
  createCoordinationState,
  registerSpawnedAgent,
} from '../src/modules/ai/agents/autonomous/coordination-state';

describe('coordination-state', () => {
  it('allows spawning within maxAgents and maxDepth', () => {
    const state = createCoordinationState('root-1', {
      maxAgents: 3,
      maxDepth: 2,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    expect(() => assertCanSpawnAgent(state, 1)).not.toThrow();
    registerSpawnedAgent(state);
    expect(state.agentCount).toBe(2);
  });

  it('rejects spawning once maxAgents is reached', () => {
    const state = createCoordinationState('root-1', {
      maxAgents: 1,
      maxDepth: 5,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    expect(() => assertCanSpawnAgent(state, 1)).toThrow(CoordinationLimitExceededError);
    try {
      assertCanSpawnAgent(state, 1);
    } catch (error) {
      expect((error as CoordinationLimitExceededError).reason).toBe('max_agents');
    }
  });

  it('rejects spawning past maxDepth', () => {
    const state = createCoordinationState('root-1', {
      maxAgents: 10,
      maxDepth: 2,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    expect(() => assertCanSpawnAgent(state, 3)).toThrow(CoordinationLimitExceededError);
    try {
      assertCanSpawnAgent(state, 3);
    } catch (error) {
      expect((error as CoordinationLimitExceededError).reason).toBe('max_depth');
    }
  });

  it('rejects spawning once the coordination deadline has passed', () => {
    const state = createCoordinationState('root-1', {
      maxAgents: 10,
      maxDepth: 5,
      maxParallelExecutions: 2,
      timeoutMs: -1,
    });

    expect(() => assertCanSpawnAgent(state, 1)).toThrow(CoordinationLimitExceededError);
    try {
      assertCanSpawnAgent(state, 1);
    } catch (error) {
      expect((error as CoordinationLimitExceededError).reason).toBe('timeout');
    }
  });

  it('shares agentCount by reference across recursive calls', () => {
    const state = createCoordinationState('root-1', {
      maxAgents: 10,
      maxDepth: 5,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    function simulateNestedSpawn(currentState: typeof state): void {
      registerSpawnedAgent(currentState);
    }

    simulateNestedSpawn(state);
    simulateNestedSpawn(state);

    expect(state.agentCount).toBe(3);
  });
});
