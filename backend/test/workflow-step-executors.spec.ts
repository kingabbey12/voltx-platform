import { AgentStepExecutor } from '../src/modules/workflows/executors/agent-step-executor';
import { ApiStepExecutor } from '../src/modules/workflows/executors/api-step-executor';
import { ApprovalStepExecutor } from '../src/modules/workflows/executors/approval-step-executor';
import { DelayStepExecutor } from '../src/modules/workflows/executors/delay-step-executor';
import { NotificationStepExecutor } from '../src/modules/workflows/executors/notification-step-executor';
import { ToolStepExecutor } from '../src/modules/workflows/executors/tool-step-executor';
import { WebhookStepExecutor } from '../src/modules/workflows/executors/webhook-step-executor';
import {
  AgentStepDefinition,
  ApiStepDefinition,
  ApprovalStepDefinition,
  DelayStepDefinition,
  NotificationStepDefinition,
  ToolStepDefinition,
  WebhookStepDefinition,
} from '../src/modules/workflows/definition/workflow-definition.types';
import { StepExecutionContext } from '../src/modules/workflows/executors/step-executor.interface';

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
  let executor: NotificationStepExecutor;
  const originalFetch = global.fetch;

  beforeEach(() => {
    executor = new NotificationStepExecutor();
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
  let executor: ApprovalStepExecutor;

  beforeEach(() => {
    workflowApprovalRepository = { findByStepRun: jest.fn(), create: jest.fn() };
    executor = new ApprovalStepExecutor(workflowApprovalRepository as never);
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
