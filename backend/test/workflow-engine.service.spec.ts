import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WorkflowEngineService } from '../src/modules/workflows/engine/workflow-engine.service';
import { WorkflowDefinition } from '../src/modules/workflows/definition/workflow-definition.types';
import { WorkflowRunEntity } from '../src/modules/workflows/entities/workflow-run.entity';
import { WorkflowStepRunEntity } from '../src/modules/workflows/entities/workflow-step-run.entity';

function runFixture(overrides: Partial<WorkflowRunEntity> = {}): WorkflowRunEntity {
  return {
    id: 'run-1',
    organizationId: 'org-1',
    workflowId: 'workflow-1',
    workflowVersionId: 'version-1',
    conversationId: 'conversation-1',
    status: 'PENDING',
    triggerType: 'MANUAL',
    input: {},
    context: {},
    output: {},
    currentStepId: null,
    idempotencyKey: null,
    triggeredBy: null,
    error: null,
    version: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    queuedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Stateful in-memory fake — the engine's control flow depends on reading back state it just wrote, so plain jest.fn() stubs can't drive it correctly. */
class FakeWorkflowRunRepository {
  constructor(private run: WorkflowRunEntity) {}

  findById(id: string): Promise<WorkflowRunEntity | null> {
    return Promise.resolve(this.run.id === id ? { ...this.run } : null);
  }

  updateWithVersion(
    _id: string,
    expectedVersion: number,
    data: Partial<WorkflowRunEntity>,
  ): Promise<WorkflowRunEntity> {
    if (this.run.version !== expectedVersion) {
      return Promise.reject(new ConflictException('stale version'));
    }
    this.run = { ...this.run, ...data, version: this.run.version + 1 };
    return Promise.resolve({ ...this.run });
  }

  update(_id: string, data: Partial<WorkflowRunEntity>): Promise<WorkflowRunEntity> {
    this.run = { ...this.run, ...data };
    return Promise.resolve({ ...this.run });
  }

  getSnapshot(): WorkflowRunEntity {
    return { ...this.run };
  }

  setStatus(status: WorkflowRunEntity['status']): void {
    this.run = { ...this.run, status };
  }
}

class FakeWorkflowStepRunRepository {
  private readonly byKey = new Map<string, WorkflowStepRunEntity>();

  upsertPending(data: {
    workflowRunId: string;
    stepId: string;
    type: WorkflowStepRunEntity['type'];
    input?: Record<string, unknown>;
  }): Promise<WorkflowStepRunEntity> {
    const key = `${data.workflowRunId}:${data.stepId}`;
    const existing = this.byKey.get(key);
    if (existing) {
      return Promise.resolve(existing);
    }
    const created: WorkflowStepRunEntity = {
      id: randomUUID(),
      organizationId: 'org-1',
      workflowRunId: data.workflowRunId,
      stepId: data.stepId,
      type: data.type,
      status: 'PENDING',
      input: data.input ?? {},
      output: {},
      attempt: 0,
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.byKey.set(key, created);
    return Promise.resolve(created);
  }

  update(id: string, data: Partial<WorkflowStepRunEntity>): Promise<WorkflowStepRunEntity> {
    const entry = Array.from(this.byKey.values()).find((item) => item.id === id);
    if (!entry) {
      return Promise.reject(new Error(`step run ${id} not found`));
    }
    Object.assign(entry, data);
    return Promise.resolve({ ...entry });
  }

  listByRun(workflowRunId: string): Promise<WorkflowStepRunEntity[]> {
    return Promise.resolve(
      Array.from(this.byKey.values()).filter((item) => item.workflowRunId === workflowRunId),
    );
  }

  getByStepId(stepId: string): WorkflowStepRunEntity | undefined {
    return Array.from(this.byKey.values()).find((item) => item.stepId === stepId);
  }
}

function configServiceWithDefaults(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'workflow.defaultStepTimeoutMs': 5000,
    'workflow.defaultMaxAttempts': 1,
    'workflow.defaultBackoffMs': 5,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultValue: unknown) => defaults[key] ?? defaultValue),
  } as never;
}

async function drainEvents<T, R>(
  generator: AsyncGenerator<T, R>,
): Promise<{ events: T[]; result: R }> {
  const events: T[] = [];
  let step = await generator.next();
  while (!step.done) {
    events.push(step.value);
    step = await generator.next();
  }
  return { events, result: step.value };
}

describe('WorkflowEngineService', () => {
  let runRepository: FakeWorkflowRunRepository;
  let stepRunRepository: FakeWorkflowStepRunRepository;
  let workflowVersionRepository: { findById: jest.Mock };
  let workflowLogRepository: { create: jest.Mock };
  let workflowCheckpointRepository: { create: jest.Mock };
  let workflowRetryRepository: { create: jest.Mock };
  let workflowDeadLetterRepository: { create: jest.Mock };
  let stepExecutorRegistry: { get: jest.Mock };
  let aiGatewayService: { executeTool: jest.Mock };
  let webhookDispatchService: { publish: jest.Mock };

  function buildEngine(configOverrides: Record<string, unknown> = {}): WorkflowEngineService {
    return new WorkflowEngineService(
      runRepository as never,
      workflowVersionRepository as never,
      stepRunRepository as never,
      workflowLogRepository as never,
      workflowCheckpointRepository as never,
      workflowRetryRepository as never,
      workflowDeadLetterRepository as never,
      stepExecutorRegistry as never,
      aiGatewayService as never,
      webhookDispatchService as never,
      configServiceWithDefaults(configOverrides),
    );
  }

  function setDefinition(definition: WorkflowDefinition): void {
    workflowVersionRepository.findById.mockResolvedValue({
      id: 'version-1',
      organizationId: 'org-1',
      workflowId: 'workflow-1',
      version: 1,
      definition,
      createdBy: 'user-1',
      createdAt: new Date(),
    });
  }

  beforeEach(() => {
    workflowVersionRepository = { findById: jest.fn() };
    workflowLogRepository = { create: jest.fn().mockResolvedValue(undefined) };
    workflowCheckpointRepository = { create: jest.fn().mockResolvedValue(undefined) };
    workflowRetryRepository = { create: jest.fn().mockResolvedValue(undefined) };
    workflowDeadLetterRepository = { create: jest.fn().mockResolvedValue(undefined) };
    stepExecutorRegistry = { get: jest.fn() };
    aiGatewayService = { executeTool: jest.fn().mockResolvedValue({ result: { content: 'ok' } }) };
    webhookDispatchService = { publish: jest.fn().mockResolvedValue(undefined) };
    stepRunRepository = new FakeWorkflowStepRunRepository();
  });

  function executorReturning(output: Record<string, unknown>) {
    return { execute: jest.fn().mockResolvedValue({ output }) };
  }

  it('executes a simple two-step sequential workflow to completion', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [
        { id: 'a', name: 'A', type: 'TOOL', config: { toolName: 'noop', input: {} } },
        {
          id: 'b',
          name: 'B',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          dependsOn: ['a'],
        },
      ],
    });

    const executorA = executorReturning({ value: 1 });
    const executorB = executorReturning({ value: 2 });
    stepExecutorRegistry.get.mockReturnValue(executorA);

    const engine = buildEngine();
    const { events } = await drainEvents(engine.executeRun('run-1'));

    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'workflow_started',
        'step_started',
        'step_completed',
        'workflow_completed',
      ]),
    );
    expect(runRepository.getSnapshot().status).toBe('SUCCEEDED');
    expect(runRepository.getSnapshot().context).toEqual({ a: { value: 1 }, b: { value: 1 } });
    // (executorA is reused for both steps in this fixture; what matters is call count and ordering)
    expect(executorA.execute).toHaveBeenCalledTimes(2);
    void executorB;
  });

  it('runs independent parallel branches concurrently', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [
        { id: 'start', name: 'Start', type: 'TOOL', config: { toolName: 'noop', input: {} } },
        {
          id: 'branch-a',
          name: 'Branch A',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          dependsOn: ['start'],
        },
        {
          id: 'branch-b',
          name: 'Branch B',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          dependsOn: ['start'],
        },
      ],
    });

    let concurrentCount = 0;
    let maxConcurrent = 0;
    stepExecutorRegistry.get.mockReturnValue({
      execute: jest.fn().mockImplementation(async () => {
        concurrentCount += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise((resolve) => setTimeout(resolve, 20));
        concurrentCount -= 1;
        return { output: {} };
      }),
    });

    const engine = buildEngine();
    await drainEvents(engine.executeRun('run-1'));

    expect(maxConcurrent).toBe(2);
    expect(runRepository.getSnapshot().status).toBe('SUCCEEDED');
  });

  it('skips a step whose condition evaluates false, without running its executor', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture({ input: { proceed: false } }));
    setDefinition({
      steps: [
        {
          id: 'gate',
          name: 'Gate',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          condition: { path: 'input.proceed', operator: 'truthy' },
        },
      ],
    });

    const executor = executorReturning({});
    stepExecutorRegistry.get.mockReturnValue(executor);

    const engine = buildEngine();
    const { events } = await drainEvents(engine.executeRun('run-1'));

    expect(executor.execute).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'step_skipped')).toBe(true);
    expect(runRepository.getSnapshot().status).toBe('SUCCEEDED');
  });

  it('retries a failing step and succeeds on the second attempt', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [
        {
          id: 'flaky',
          name: 'Flaky',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          retryPolicy: { maxAttempts: 2, backoffMs: 5 },
        },
      ],
    });

    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce({ output: { ok: true } });
    stepExecutorRegistry.get.mockReturnValue({ execute });

    const engine = buildEngine();
    const { events } = await drainEvents(engine.executeRun('run-1'));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.type === 'step_retrying')).toBe(true);
    expect(workflowRetryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 1, error: 'transient failure' }),
    );
    expect(runRepository.getSnapshot().status).toBe('SUCCEEDED');
  });

  it('fails the run, dead-letters the step, and runs compensation after retries are exhausted', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [
        {
          id: 'reserve',
          name: 'Reserve',
          type: 'TOOL',
          config: { toolName: 'reserve_slot', input: {} },
          compensation: { toolName: 'release_slot', input: { slotId: 'abc' } },
        },
        {
          id: 'charge',
          name: 'Charge',
          type: 'TOOL',
          config: { toolName: 'charge_card', input: {} },
          dependsOn: ['reserve'],
          retryPolicy: { maxAttempts: 1, backoffMs: 0 },
        },
      ],
    });

    stepExecutorRegistry.get.mockReturnValue({
      execute: jest.fn().mockImplementation((step: { id: string }) => {
        if (step.id === 'charge') {
          return Promise.reject(new Error('card declined'));
        }
        return Promise.resolve({ output: { reserved: true } });
      }),
    });

    const engine = buildEngine();
    const { events } = await drainEvents(engine.executeRun('run-1'));

    expect(events.some((e) => e.type === 'step_failed')).toBe(true);
    expect(events.some((e) => e.type === 'workflow_failed')).toBe(true);
    expect(runRepository.getSnapshot().status).toBe('FAILED');
    expect(workflowDeadLetterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: 'charge', reason: 'card declined' }),
    );
    expect(aiGatewayService.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'release_slot', input: { slotId: 'abc' } }),
      expect.anything(),
    );
  });

  it('pauses at an approval step and resumes once it is approved', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [{ id: 'approve', name: 'Approve', type: 'APPROVAL', config: { message: 'OK?' } }],
    });

    let approvalDecided = false;
    stepExecutorRegistry.get.mockReturnValue({
      execute: jest.fn().mockImplementation(() => {
        if (!approvalDecided) {
          return Promise.resolve({ output: {}, waiting: true });
        }
        return Promise.resolve({ output: { approved: true } });
      }),
    });

    const engine = buildEngine();

    const { events: firstEvents } = await drainEvents(engine.executeRun('run-1'));
    expect(firstEvents.some((e) => e.type === 'step_waiting_approval')).toBe(true);
    expect(firstEvents.some((e) => e.type === 'workflow_paused')).toBe(true);
    expect(runRepository.getSnapshot().status).toBe('WAITING_APPROVAL');
    expect(stepRunRepository.getByStepId('approve')?.status).toBe('WAITING_APPROVAL');

    approvalDecided = true;
    const { events: secondEvents } = await drainEvents(engine.executeRun('run-1'));
    expect(secondEvents.some((e) => e.type === 'workflow_resumed')).toBe(true);
    expect(secondEvents.some((e) => e.type === 'workflow_completed')).toBe(true);
    expect(runRepository.getSnapshot().status).toBe('SUCCEEDED');
  });

  it('stops scheduling further steps once the run is cancelled', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [
        { id: 'first', name: 'First', type: 'TOOL', config: { toolName: 'noop', input: {} } },
        {
          id: 'second',
          name: 'Second',
          type: 'TOOL',
          config: { toolName: 'noop', input: {} },
          dependsOn: ['first'],
        },
      ],
    });

    const secondExecute = jest.fn().mockResolvedValue({ output: {} });
    stepExecutorRegistry.get.mockReturnValue({
      execute: jest.fn().mockImplementation((step: { id: string }): Promise<{ output: object }> => {
        if (step.id === 'first') {
          // Simulate an out-of-band cancel request arriving while this step is executing.
          runRepository.setStatus('CANCELLED');
        }
        if (step.id === 'second') {
          return secondExecute() as Promise<{ output: object }>;
        }
        return Promise.resolve({ output: {} });
      }),
    });

    const engine = buildEngine();
    const { events } = await drainEvents(engine.executeRun('run-1'));

    expect(events.some((e) => e.type === 'workflow_cancelled')).toBe(true);
    expect(secondExecute).not.toHaveBeenCalled();
  });

  it('writes a checkpoint after every successful step', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [{ id: 'a', name: 'A', type: 'TOOL', config: { toolName: 'noop', input: {} } }],
    });
    stepExecutorRegistry.get.mockReturnValue(executorReturning({ done: true }));

    const engine = buildEngine();
    await drainEvents(engine.executeRun('run-1'));

    expect(workflowCheckpointRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: 'run-1', stepId: 'a' }),
    );
  });

  it('reports isActiveInProcess only while the run is executing', async () => {
    runRepository = new FakeWorkflowRunRepository(runFixture());
    setDefinition({
      steps: [{ id: 'a', name: 'A', type: 'TOOL', config: { toolName: 'noop', input: {} } }],
    });

    let activeDuringExecution = false;
    const engine = buildEngine();
    stepExecutorRegistry.get.mockReturnValue({
      execute: jest.fn().mockImplementation(() => {
        activeDuringExecution = engine.isActiveInProcess('run-1');
        return Promise.resolve({ output: {} });
      }),
    });

    expect(engine.isActiveInProcess('run-1')).toBe(false);
    await drainEvents(engine.executeRun('run-1'));

    expect(activeDuringExecution).toBe(true);
    expect(engine.isActiveInProcess('run-1')).toBe(false);
  });
});
