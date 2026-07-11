import { AgentStepExecutor } from '../src/modules/workflows/executors/agent-step-executor';
import { ApiStepExecutor } from '../src/modules/workflows/executors/api-step-executor';
import { ApprovalStepExecutor } from '../src/modules/workflows/executors/approval-step-executor';
import { DelayStepExecutor } from '../src/modules/workflows/executors/delay-step-executor';
import { LoopStepExecutor } from '../src/modules/workflows/executors/loop-step-executor';
import { NotificationStepExecutor } from '../src/modules/workflows/executors/notification-step-executor';
import { SwitchStepExecutor } from '../src/modules/workflows/executors/switch-step-executor';
import { ToolStepExecutor } from '../src/modules/workflows/executors/tool-step-executor';
import { WebhookStepExecutor } from '../src/modules/workflows/executors/webhook-step-executor';
import {
  AgentStepDefinition,
  ApiStepDefinition,
  ApprovalStepDefinition,
  DelayStepDefinition,
  LoopStepDefinition,
  NotificationStepDefinition,
  SwitchStepDefinition,
  ToolStepDefinition,
  WebhookStepDefinition,
} from '../src/modules/workflows/definition/workflow-definition.types';
import {
  StepExecutionContext,
  StepExecutor,
} from '../src/modules/workflows/executors/step-executor.interface';

function contextFixture(overrides: Partial<StepExecutionContext> = {}): StepExecutionContext {
  return {
    organizationId: 'org-1',
    workflowRunId: 'run-1',
    stepRunId: 'step-run-1',
    conversationId: 'conversation-1',
    runInput: {},
    runContext: {},
    grantedPermissions: [],
    ...overrides,
  };
}

describe('AgentStepExecutor', () => {
  let agentService: { findAgentByName: jest.Mock; runAutonomousAgentStream: jest.Mock };
  let executor: AgentStepExecutor;

  beforeEach(() => {
    agentService = { findAgentByName: jest.fn(), runAutonomousAgentStream: jest.fn() };
    executor = new AgentStepExecutor(agentService as never);
  });

  const step: AgentStepDefinition = {
    id: 'summarize',
    name: 'Summarize',
    type: 'AGENT',
    config: { agentName: 'Sales Assistant', objective: 'Summarize the deal.' },
  };

  it('throws when the named agent does not exist', async () => {
    agentService.findAgentByName.mockResolvedValue(null);
    await expect(executor.execute(step, contextFixture())).rejects.toThrow(
      'Agent "Sales Assistant" was not found or is disabled',
    );
  });

  it('throws when the named agent is disabled', async () => {
    agentService.findAgentByName.mockResolvedValue({ id: 'agent-1', enabled: false });
    await expect(executor.execute(step, contextFixture())).rejects.toThrow(
      'was not found or is disabled',
    );
  });

  it('runs the agent and returns its output text, injecting previous-step outputs into workspaceContext', async () => {
    agentService.findAgentByName.mockResolvedValue({ id: 'agent-1', enabled: true });
    agentService.runAutonomousAgentStream.mockReturnValue(
      // eslint-disable-next-line require-yield, @typescript-eslint/require-await -- yield-less by design: this mock never streams events, only resolves.
      (async function* () {
        return {
          run: { id: 'run-1', status: 'SUCCEEDED', output: { iterations: 1 } },
          userMessage: {},
          toolMessages: [],
          assistantMessage: { content: 'Deal summarized.' },
        };
      })(),
    );

    const result = await executor.execute(
      step,
      contextFixture({ runContext: { previous: { dealSize: 5000 } } }),
    );

    expect(result.output.outputText).toBe('Deal summarized.');
    expect(result.output.runId).toBe('run-1');
    const [, dto] = agentService.runAutonomousAgentStream.mock.calls[0] as [
      string,
      { workspaceContext: string[] },
    ];
    expect(dto.workspaceContext.some((entry) => entry.includes('previous'))).toBe(true);
    expect(dto.workspaceContext.some((entry) => entry.includes('5000'))).toBe(true);
  });
});

describe('ToolStepExecutor', () => {
  let aiGatewayService: { executeTool: jest.Mock };
  let executor: ToolStepExecutor;

  beforeEach(() => {
    aiGatewayService = { executeTool: jest.fn() };
    executor = new ToolStepExecutor(aiGatewayService as never);
  });

  const step: ToolStepDefinition = {
    id: 'lookup',
    name: 'Lookup',
    type: 'TOOL',
    config: { toolName: 'datetime', input: {} },
  };

  it('returns the tool result content on success', async () => {
    aiGatewayService.executeTool.mockResolvedValue({
      result: { toolName: 'datetime', content: '{"iso":"now"}', isError: false },
    });

    const result = await executor.execute(step, contextFixture());
    expect(result.output.content).toBe('{"iso":"now"}');
  });

  it('throws when the tool result is an error', async () => {
    aiGatewayService.executeTool.mockResolvedValue({
      result: { toolName: 'datetime', content: 'boom', isError: true },
    });

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('boom');
  });
});

describe('ApiStepExecutor', () => {
  let executor: ApiStepExecutor;
  const originalFetch = global.fetch;

  beforeEach(() => {
    executor = new ApiStepExecutor();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const step: ApiStepDefinition = {
    id: 'call',
    name: 'Call',
    type: 'API',
    config: { method: 'GET', url: 'https://example.com/api' },
  };

  it('returns status and parsed JSON body on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{"result":"ok"}'),
    }) as never;

    const result = await executor.execute(step, contextFixture());
    expect(result.output.status).toBe(200);
    expect(result.output.body).toEqual({ result: 'ok' });
  });

  it('throws when the response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: () => Promise.resolve(''),
    }) as never;

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('status 500');
  });

  it('rejects a non-HTTP URL', async () => {
    const badStep: ApiStepDefinition = {
      ...step,
      config: { ...step.config, url: 'ftp://example.com' },
    };
    await expect(executor.execute(badStep, contextFixture())).rejects.toThrow(
      'Only HTTP and HTTPS URLs are allowed',
    );
  });
});

describe('WebhookStepExecutor', () => {
  let executor: WebhookStepExecutor;
  const originalFetch = global.fetch;

  beforeEach(() => {
    executor = new WebhookStepExecutor();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const step: WebhookStepDefinition = {
    id: 'notify',
    name: 'Notify',
    type: 'WEBHOOK',
    config: { url: 'https://example.com/hook', payload: { message: 'hi' } },
  };

  it('POSTs the payload and returns status/body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{}'),
    });
    global.fetch = fetchMock as never;

    const result = await executor.execute(step, contextFixture());
    expect(result.output.status).toBe(202);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body as string)).toEqual({ message: 'hi' });
  });

  it('throws when the webhook responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
      text: () => Promise.resolve(''),
    }) as never;

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('status 503');
  });
});

describe('NotificationStepExecutor', () => {
  let notificationService: { create: jest.Mock };
  let executor: NotificationStepExecutor;
  const originalFetch = global.fetch;

  beforeEach(() => {
    notificationService = { create: jest.fn() };
    executor = new NotificationStepExecutor(notificationService as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('delivers a log-channel notification without any network call', async () => {
    const step: NotificationStepDefinition = {
      id: 'notify',
      name: 'Notify',
      type: 'NOTIFICATION',
      config: { channel: 'log', message: 'Deal closed.' },
    };

    const result = await executor.execute(step, contextFixture());
    expect(result.output).toEqual({ delivered: true, channel: 'log' });
  });

  it('delivers a notification-channel message via the real NotificationService', async () => {
    notificationService.create.mockResolvedValue({ id: 'notif-1' });
    const step: NotificationStepDefinition = {
      id: 'notify',
      name: 'Notify',
      type: 'NOTIFICATION',
      config: {
        channel: 'notification',
        message: 'Deal closed.',
        userId: 'user-1',
        title: 'Deal update',
      },
    };

    const result = await executor.execute(step, contextFixture());

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        category: 'WORKFLOW',
        title: 'Deal update',
        body: 'Deal closed.',
      }),
    );
    expect(result.output).toEqual({
      delivered: true,
      channel: 'notification',
      notificationId: 'notif-1',
    });
  });

  it('throws when the notification channel is missing userId', async () => {
    const step: NotificationStepDefinition = {
      id: 'notify',
      name: 'Notify',
      type: 'NOTIFICATION',
      config: { channel: 'notification', message: 'Deal closed.' },
    };

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('missing config.userId');
  });

  it('delivers a webhook-channel notification via fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () => Promise.resolve(''),
    });
    global.fetch = fetchMock as never;

    const step: NotificationStepDefinition = {
      id: 'notify',
      name: 'Notify',
      type: 'NOTIFICATION',
      config: {
        channel: 'webhook',
        message: 'Deal closed.',
        webhookUrl: 'https://example.com/hook',
      },
    };

    const result = await executor.execute(step, contextFixture());
    expect(result.output).toEqual({ delivered: true, channel: 'webhook', status: 200 });
  });
});

describe('DelayStepExecutor', () => {
  let executor: DelayStepExecutor;

  beforeEach(() => {
    executor = new DelayStepExecutor();
  });

  const step: DelayStepDefinition = {
    id: 'wait',
    name: 'Wait',
    type: 'DELAY',
    config: { delayMs: 20 },
  };

  it('resolves after the configured delay', async () => {
    const startedAt = Date.now();
    const result = await executor.execute(step, contextFixture());
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(15);
    expect(result.output).toEqual({ delayedMs: 20 });
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      executor.execute(step, contextFixture({ signal: controller.signal })),
    ).rejects.toThrow('aborted');
  });

  it('rejects when aborted mid-delay', async () => {
    const controller = new AbortController();
    const longStep: DelayStepDefinition = { ...step, config: { delayMs: 5000 } };
    const promise = executor.execute(longStep, contextFixture({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toThrow('aborted');
  });
});

describe('ApprovalStepExecutor', () => {
  let workflowApprovalRepository: {
    findByStepRun: jest.Mock;
    create: jest.Mock;
  };
  let authContextRepository: { listActiveUserIdsWithPermission: jest.Mock };
  let notificationService: { create: jest.Mock };
  let executor: ApprovalStepExecutor;

  beforeEach(() => {
    workflowApprovalRepository = {
      findByStepRun: jest.fn(),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'approval-1', workflowRunId: 'run-1', stepRunId: 'step-run-1' }),
    };
    authContextRepository = {
      listActiveUserIdsWithPermission: jest.fn().mockResolvedValue(['user-1', 'user-2']),
    };
    notificationService = { create: jest.fn().mockResolvedValue(undefined) };
    executor = new ApprovalStepExecutor(
      workflowApprovalRepository as never,
      authContextRepository as never,
      notificationService as never,
    );
  });

  const step: ApprovalStepDefinition = {
    id: 'approve',
    name: 'Approve',
    type: 'APPROVAL',
    config: { message: 'Approve the deal?' },
  };

  it('creates a pending approval and reports waiting on first entry', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue(null);

    const result = await executor.execute(step, contextFixture());

    expect(result.waiting).toBe(true);
    expect(workflowApprovalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: 'run-1', stepRunId: 'step-run-1' }),
    );
  });

  it('notifies every user with workflow.approve permission when the approval is first created', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue(null);

    await executor.execute(step, contextFixture());

    expect(authContextRepository.listActiveUserIdsWithPermission).toHaveBeenCalledWith(
      'org-1',
      'workflow.approve',
    );
    expect(notificationService.create).toHaveBeenCalledTimes(2);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        category: 'WORKFLOW',
        title: 'Workflow approval needed',
        body: 'Approve the deal?',
      }),
    );
  });

  it('does not fail the step when notifying approvers throws', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue(null);
    authContextRepository.listActiveUserIdsWithPermission.mockRejectedValue(new Error('db down'));

    const result = await executor.execute(step, contextFixture());

    expect(result.waiting).toBe(true);
  });

  it('reports waiting again when the approval is still pending', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue({ status: 'PENDING' });

    const result = await executor.execute(step, contextFixture());

    expect(result.waiting).toBe(true);
    expect(workflowApprovalRepository.create).not.toHaveBeenCalled();
  });

  it('returns success output when the approval was approved', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue({
      status: 'APPROVED',
      approverUserId: 'user-1',
      comment: 'Looks good',
    });

    const result = await executor.execute(step, contextFixture());

    expect(result.waiting).toBeUndefined();
    expect(result.output).toEqual({
      approved: true,
      approverUserId: 'user-1',
      comment: 'Looks good',
    });
  });

  it('throws when the approval was rejected', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue({
      status: 'REJECTED',
      comment: 'Too risky',
    });

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('rejected: Too risky');
  });

  it('throws when the approval expired', async () => {
    workflowApprovalRepository.findByStepRun.mockResolvedValue({ status: 'EXPIRED' });

    await expect(executor.execute(step, contextFixture())).rejects.toThrow('expired');
  });
});

describe('SwitchStepExecutor', () => {
  let executor: SwitchStepExecutor;

  beforeEach(() => {
    executor = new SwitchStepExecutor();
  });

  const step: SwitchStepDefinition = {
    id: 'route',
    name: 'Route',
    type: 'SWITCH',
    config: {
      path: 'context.classify.category',
      cases: [
        { value: 'billing', next: 'handle-billing' },
        { value: 'support', next: 'handle-support' },
      ],
      defaultNext: 'handle-other',
    },
  };

  it('resolves the matching case and returns its next target', async () => {
    const result = await executor.execute(
      step,
      contextFixture({ runContext: { classify: { category: 'support' } } }),
    );
    expect(result.output).toEqual({ matchedValue: 'support', next: 'handle-support' });
  });

  it('falls back to defaultNext when nothing matches', async () => {
    const result = await executor.execute(
      step,
      contextFixture({ runContext: { classify: { category: 'unknown' } } }),
    );
    expect(result.output).toEqual({ matchedValue: 'unknown', next: 'handle-other' });
  });

  it('returns null next when nothing matches and there is no defaultNext', async () => {
    const noDefaultStep: SwitchStepDefinition = {
      ...step,
      config: { ...step.config, defaultNext: undefined },
    };
    const result = await executor.execute(
      noDefaultStep,
      contextFixture({ runContext: { classify: { category: 'unknown' } } }),
    );
    expect(result.output).toEqual({ matchedValue: 'unknown', next: null });
  });
});

describe('LoopStepExecutor', () => {
  let registry: { get: jest.Mock };
  let executor: LoopStepExecutor;

  beforeEach(() => {
    registry = { get: jest.fn() };
    executor = new LoopStepExecutor(registry as never);
  });

  function stubExecutor(output: Record<string, unknown>): StepExecutor {
    return { type: 'TOOL', execute: jest.fn().mockResolvedValue({ output }) };
  }

  const step: LoopStepDefinition = {
    id: 'for-each-contact',
    name: 'For each contact',
    type: 'LOOP',
    config: {
      itemsPath: 'input.contacts',
      steps: [
        {
          id: 'notify-one',
          name: 'Notify one',
          type: 'TOOL',
          config: { toolName: 'x', input: {} },
        },
      ],
    },
  };

  it('runs the nested steps once per item and accumulates outputs', async () => {
    const nested = stubExecutor({ sent: true });
    registry.get.mockReturnValue(nested);

    const result = await executor.execute(
      step,
      contextFixture({ runInput: { contacts: ['a@x.com', 'b@x.com'] } }),
    );

    expect(nested.execute).toHaveBeenCalledTimes(2);
    expect(result.output).toEqual({
      items: [{ 'notify-one': { sent: true } }, { 'notify-one': { sent: true } }],
      count: 2,
    });
  });

  it('exposes loopItem/loopIndex to nested step context', async () => {
    const nested = stubExecutor({ ok: true });
    registry.get.mockReturnValue(nested);

    await executor.execute(step, contextFixture({ runInput: { contacts: ['only@x.com'] } }));

    const [, nestedContext] = (nested.execute as jest.Mock).mock.calls[0] as [
      unknown,
      { runContext: { loopItem: unknown; loopIndex: number } },
    ];
    expect(nestedContext.runContext.loopItem).toBe('only@x.com');
    expect(nestedContext.runContext.loopIndex).toBe(0);
  });

  it('skips a nested step whose condition evaluates false', async () => {
    const nested = stubExecutor({ ok: true });
    registry.get.mockReturnValue(nested);
    const gatedStep: LoopStepDefinition = {
      ...step,
      config: {
        ...step.config,
        steps: [
          {
            id: 'notify-one',
            name: 'Notify one',
            type: 'TOOL',
            config: { toolName: 'x', input: {} },
            condition: { path: 'input.enabled', operator: 'truthy' },
          },
        ],
      },
    };

    const result = await executor.execute(
      gatedStep,
      contextFixture({ runInput: { contacts: ['a@x.com'], enabled: false } }),
    );

    expect(nested.execute).not.toHaveBeenCalled();
    expect(result.output).toEqual({ items: [{}], count: 1 });
  });

  it('respects maxIterations', async () => {
    const nested = stubExecutor({ ok: true });
    registry.get.mockReturnValue(nested);
    const limitedStep: LoopStepDefinition = {
      ...step,
      config: { ...step.config, maxIterations: 1 },
    };

    const result = await executor.execute(
      limitedStep,
      contextFixture({ runInput: { contacts: ['a@x.com', 'b@x.com', 'c@x.com'] } }),
    );

    expect(nested.execute).toHaveBeenCalledTimes(1);
    expect(result.output.count).toBe(1);
  });

  it('throws when itemsPath does not resolve to an array', async () => {
    await expect(
      executor.execute(step, contextFixture({ runInput: { contacts: 'not-an-array' } })),
    ).rejects.toThrow('did not resolve to an array');
  });

  it('throws immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      executor.execute(
        step,
        contextFixture({ runInput: { contacts: ['a@x.com'] }, signal: controller.signal }),
      ),
    ).rejects.toThrow('aborted');
  });
});
