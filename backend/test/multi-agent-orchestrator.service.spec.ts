import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { AgentFactory } from '../src/modules/ai/agents/agent.factory';
import { AgentRepository } from '../src/modules/ai/agents/agent.repository';
import { AgentLoopService } from '../src/modules/ai/agents/autonomous/agent-loop.service';
import { AgentMessageRepository } from '../src/modules/ai/agents/autonomous/agent-message.repository';
import { AgentRunStepRepository } from '../src/modules/ai/agents/autonomous/agent-run-step.repository';
import { createCoordinationState } from '../src/modules/ai/agents/autonomous/coordination-state';
import { MultiAgentOrchestratorService } from '../src/modules/ai/agents/autonomous/multi-agent-orchestrator.service';
import { AgentEntity } from '../src/modules/ai/agents/entities/agent.entity';
import { AgentRunEntity } from '../src/modules/ai/agents/entities/agent-run.entity';
import { AiUsageService } from '../src/modules/ai/gateway/ai-usage.service';

function buildAgent(overrides: Partial<AgentEntity> = {}): AgentEntity {
  return {
    id: 'agent-1',
    organizationId: 'org-1',
    name: 'Executive Assistant',
    description: 'Coordinator agent',
    systemPrompt: 'You are the coordinator.',
    provider: 'openai',
    model: 'gpt-5-mini',
    configuration: {},
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildRun(overrides: Partial<AgentRunEntity> = {}): AgentRunEntity {
  return {
    id: 'run-1',
    agentId: 'agent-1',
    conversationId: 'conversation-1',
    parentRunId: null,
    rootRunId: 'run-1',
    depth: 0,
    status: 'RUNNING',
    input: {},
    output: {},
    currentStep: 0,
    iterationCount: 0,
    toolCallCount: 0,
    startedAt: new Date(),
    completedAt: null,
    durationMs: null,
    tokenUsage: {},
    error: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function loopResultOf(outputText: string) {
  return {
    outputText,
    iterations: 1,
    toolCallCount: 0,
    stoppedReason: 'final_answer' as const,
    tokenUsage: {},
    userMessage: {
      id: 'msg-user',
      conversationId: 'conversation-1',
      role: 'user' as const,
      content: 'objective',
      metadata: {},
      tokenUsage: {},
      createdAt: new Date().toISOString(),
    },
    toolMessages: [],
    assistantMessage: null,
    toolResults: [],
    plan: { objective: 'objective', steps: [] },
  };
}

// eslint-disable-next-line require-yield -- yield-less by design: satisfies AsyncGenerator-typed mocks that never actually stream events.
async function* generatorReturning<T>(value: T): AsyncGenerator<never, T> {
  await Promise.resolve();
  return value;
}

// eslint-disable-next-line require-yield -- yield-less by design: satisfies AsyncGenerator-typed mocks that never actually stream events.
async function* generatorThrowing(error: Error): AsyncGenerator<never, never> {
  await Promise.resolve();
  throw error;
}

async function drain<T, R>(generator: AsyncGenerator<T, R>): Promise<{ events: T[]; result: R }> {
  const events: T[] = [];
  let step = await generator.next();
  while (!step.done) {
    events.push(step.value);
    step = await generator.next();
  }
  return { events, result: step.value };
}

describe('MultiAgentOrchestratorService', () => {
  let service: MultiAgentOrchestratorService;
  let agentLoopService: jest.Mocked<AgentLoopService>;
  let agentRepository: jest.Mocked<AgentRepository>;
  let agentFactory: jest.Mocked<AgentFactory>;
  let agentMessageRepository: jest.Mocked<AgentMessageRepository>;
  let agentRunStepRepository: jest.Mocked<AgentRunStepRepository>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiAgentOrchestratorService,
        {
          provide: AgentLoopService,
          useValue: { run: jest.fn() },
        },
        {
          provide: AgentRepository,
          useValue: {
            findAgentByName: jest.fn(),
            createAgentRun: jest.fn(),
            updateAgentRun: jest.fn().mockResolvedValue(buildRun()),
          },
        },
        {
          provide: AgentFactory,
          useValue: {
            canDelegate: jest.fn().mockReturnValue(true),
            getAllowedDelegateAgentNames: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: AgentMessageRepository,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AgentRunStepRepository,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AiUsageService,
          useValue: {
            summarizeForAgentRun: jest.fn().mockResolvedValue({
              callCount: 0,
              totalTokens: 0,
              totalCostUsd: 0,
              totalDurationMs: 0,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, defaultValue: number) => defaultValue) },
        },
      ],
    }).compile();

    service = module.get(MultiAgentOrchestratorService);
    agentLoopService = module.get(AgentLoopService);
    agentRepository = module.get(AgentRepository);
    agentFactory = module.get(AgentFactory);
    agentMessageRepository = module.get(AgentMessageRepository);
    agentRunStepRepository = module.get(AgentRunStepRepository);
    auditService = module.get(AuditService);
  });

  describe('runAgent', () => {
    it('finalizes a root run as SUCCEEDED and emits coordinator lifecycle events unwrapped', async () => {
      agentLoopService.run.mockReturnValue(generatorReturning(loopResultOf('Root answer.')));
      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 5,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { events, result } = await drain(
        service.runAgent(
          buildAgent(),
          buildRun(),
          { objective: 'objective' },
          coordinationState,
          [],
        ),
      );

      expect(events.some((event) => event.type === 'coordinator_started')).toBe(true);
      expect(events.some((event) => event.type === 'agent_working')).toBe(true);
      expect(
        events.some((event) => event.type === 'agent_completed' && event.succeeded === true),
      ).toBe(true);
      expect(events.some((event) => event.type === 'coordinator_finished')).toBe(true);
      expect(result.outputText).toBe('Root answer.');

      expect(agentRepository.updateAgentRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'SUCCEEDED' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'run_autonomous' }),
      );
    });

    it('wraps a child run event stream in agent_event and audits as delegate_run', async () => {
      agentLoopService.run.mockReturnValue(generatorReturning(loopResultOf('Child answer.')));
      const coordinationState = createCoordinationState('root-run', {
        maxAgents: 5,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });
      const childRun = buildRun({ id: 'child-run', parentRunId: 'root-run', depth: 1 });

      const { events } = await drain(
        service.runAgent(
          buildAgent(),
          childRun,
          { objective: 'sub objective' },
          coordinationState,
          [],
        ),
      );

      expect(events.some((event) => event.type === 'coordinator_started')).toBe(false);
      expect(events.some((event) => event.type === 'coordinator_finished')).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delegate_run' }),
      );
    });

    it('marks the run FAILED and rethrows when the loop fails', async () => {
      agentLoopService.run.mockReturnValue(generatorThrowing(new Error('loop exploded')));
      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 5,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      await expect(
        drain(
          service.runAgent(
            buildAgent(),
            buildRun(),
            { objective: 'objective' },
            coordinationState,
            [],
          ),
        ),
      ).rejects.toThrow('loop exploded');

      expect(agentRepository.updateAgentRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'FAILED', error: 'loop exploded' }),
      );
    });
  });

  describe('delegate', () => {
    it('spawns a child run, drives it to completion, and returns a successful outcome', async () => {
      const targetAgent = buildAgent({ id: 'agent-2', name: 'Sales Assistant' });
      agentRepository.findAgentByName.mockResolvedValue(targetAgent);
      agentRepository.createAgentRun.mockResolvedValue(
        buildRun({ id: 'child-run', agentId: 'agent-2', parentRunId: 'run-1', depth: 1 }),
      );
      agentLoopService.run.mockReturnValue(
        generatorReturning(loopResultOf('Pipeline is healthy.')),
      );

      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 5,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { events, result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result).toEqual({
        agentName: 'Sales Assistant',
        succeeded: true,
        resultText: 'Pipeline is healthy.',
      });
      expect(events.some((event) => event.type === 'agent_spawned')).toBe(true);
      expect(events.some((event) => event.type === 'delegation')).toBe(true);
      expect(events.some((event) => event.type === 'agent_waiting')).toBe(true);
      expect(events.some((event) => event.type === 'aggregation')).toBe(true);
      expect(coordinationState.agentCount).toBe(2);

      expect(agentMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUEST', toAgentRunId: 'child-run' }),
      );
      expect(agentMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COMPLETION', fromAgentRunId: 'child-run' }),
      );
      expect(agentRunStepRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DELEGATION_START' }),
      );
      expect(agentRunStepRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DELEGATION_RESULT' }),
      );
    });

    it('fails gracefully without spawning a run when the target agent does not exist', async () => {
      agentRepository.findAgentByName.mockResolvedValue(null);
      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 5,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Nonexistent Agent', objective: 'Do something.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result.succeeded).toBe(false);
      expect(agentRepository.createAgentRun).not.toHaveBeenCalled();
    });

    it('fails gracefully without spawning a run once the agent-count limit is reached', async () => {
      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 1,
        maxDepth: 5,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Sales Assistant', objective: 'Do something.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result.succeeded).toBe(false);
      expect(result.resultText).toContain('Maximum agent count');
      expect(agentRepository.createAgentRun).not.toHaveBeenCalled();
    });

    it('retries once after a failure and succeeds on the second attempt', async () => {
      const targetAgent = buildAgent({ id: 'agent-2', name: 'Sales Assistant' });
      agentRepository.findAgentByName.mockResolvedValue(targetAgent);
      agentRepository.createAgentRun
        .mockResolvedValueOnce(buildRun({ id: 'child-run-1', parentRunId: 'run-1', depth: 1 }))
        .mockResolvedValueOnce(buildRun({ id: 'child-run-2', parentRunId: 'run-1', depth: 1 }));
      agentLoopService.run
        .mockReturnValueOnce(generatorThrowing(new Error('first attempt failed')))
        .mockReturnValueOnce(generatorReturning(loopResultOf('Second attempt succeeded.')));

      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 10,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Sales Assistant', objective: 'Try twice.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result).toEqual({
        agentName: 'Sales Assistant',
        succeeded: true,
        resultText: 'Second attempt succeeded.',
      });
      expect(agentRepository.createAgentRun).toHaveBeenCalledTimes(2);
      expect(coordinationState.agentCount).toBe(3);
    });

    it('gives up and reports failure after exhausting retries', async () => {
      const targetAgent = buildAgent({ id: 'agent-2', name: 'Sales Assistant' });
      agentRepository.findAgentByName.mockResolvedValue(targetAgent);
      agentRepository.createAgentRun.mockResolvedValue(
        buildRun({ id: 'child-run', parentRunId: 'run-1', depth: 1 }),
      );
      agentLoopService.run.mockImplementation(() => generatorThrowing(new Error('always fails')));

      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 10,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Sales Assistant', objective: 'Always fails.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result.succeeded).toBe(false);
      expect(result.resultText).toContain('always fails');
      expect(agentMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'OBSERVATION' }),
      );
    });

    it('rejects delegation to an agent outside the allow-list', async () => {
      agentFactory.getAllowedDelegateAgentNames.mockReturnValue(['Customer Support']);
      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 10,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegate(
          buildAgent(),
          buildRun(),
          { agentName: 'Sales Assistant', objective: 'Not allowed.' },
          1,
          coordinationState,
          [],
        ),
      );

      expect(result.succeeded).toBe(false);
      expect(agentRepository.findAgentByName).not.toHaveBeenCalled();
    });
  });

  describe('delegateParallel', () => {
    it('runs independent delegations concurrently and isolates a failure', async () => {
      agentRepository.findAgentByName.mockImplementation((name: string) =>
        Promise.resolve(buildAgent({ id: `agent-${name}`, name })),
      );
      agentRepository.createAgentRun.mockImplementation((data) =>
        Promise.resolve(
          buildRun({
            id: `child-of-${data.agentId}`,
            agentId: data.agentId,
            parentRunId: 'run-1',
            depth: 1,
          }),
        ),
      );
      agentLoopService.run.mockImplementation((agent) =>
        agent.name === 'Failing Agent'
          ? generatorThrowing(new Error('this one fails'))
          : generatorReturning(loopResultOf(`${agent.name} done.`)),
      );

      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 10,
        maxDepth: 2,
        maxParallelExecutions: 4,
        timeoutMs: 60_000,
      });

      const { result } = await drain(
        service.delegateParallel(
          buildAgent(),
          buildRun(),
          [
            { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
            { agentName: 'Failing Agent', objective: 'This will fail.' },
            { agentName: 'Customer Support', objective: 'Summarize tickets.' },
          ],
          1,
          coordinationState,
          [],
        ),
      );

      expect(result).toHaveLength(3);
      const byAgent = Object.fromEntries(result.map((outcome) => [outcome.agentName, outcome]));
      expect(byAgent['Sales Assistant']?.succeeded).toBe(true);
      expect(byAgent['Failing Agent']?.succeeded).toBe(false);
      expect(byAgent['Customer Support']?.succeeded).toBe(true);
    });

    it('respects the max-parallel-executions batch size across a larger fan-out', async () => {
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;

      agentRepository.findAgentByName.mockImplementation((name: string) =>
        Promise.resolve(buildAgent({ id: `agent-${name}`, name })),
      );
      agentRepository.createAgentRun.mockImplementation((data) =>
        Promise.resolve(
          buildRun({
            id: `child-of-${data.agentId}-${Math.random()}`,
            agentId: data.agentId,
            parentRunId: 'run-1',
            depth: 1,
          }),
        ),
      );
      agentLoopService.run.mockImplementation(() => {
        concurrentCount += 1;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        // eslint-disable-next-line require-yield -- yield-less by design: this mock never streams events, only resolves.
        return (async function* () {
          await new Promise((resolve) => setTimeout(resolve, 10));
          concurrentCount -= 1;
          return loopResultOf('done');
        })();
      });

      const coordinationState = createCoordinationState('run-1', {
        maxAgents: 20,
        maxDepth: 2,
        maxParallelExecutions: 2,
        timeoutMs: 60_000,
      });

      await drain(
        service.delegateParallel(
          buildAgent(),
          buildRun(),
          Array.from({ length: 6 }, (_, index) => ({
            agentName: `Agent ${index}`,
            objective: `Task ${index}`,
          })),
          1,
          coordinationState,
          [],
        ),
      );

      expect(maxConcurrentSeen).toBeLessThanOrEqual(2);
    });
  });
});
