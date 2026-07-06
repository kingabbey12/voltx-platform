import { IntegrationStepExecutor } from '../src/modules/integrations/workflow/integration-step-executor';
import { WorkflowStepDefinition } from '../src/modules/workflows/definition/workflow-definition.types';
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

describe('IntegrationStepExecutor', () => {
  let dispatcher: { execute: jest.Mock };
  let executor: IntegrationStepExecutor;

  beforeEach(() => {
    dispatcher = { execute: jest.fn() };
    executor = new IntegrationStepExecutor(dispatcher as never);
  });

  const step: WorkflowStepDefinition = {
    id: 'send-slack',
    name: 'Send Slack message',
    type: 'INTEGRATION',
    config: {
      provider: 'SLACK',
      actionName: 'post_message',
      connectionId: 'conn-1',
      input: { channel: '#general', text: 'Deal closed!' },
    },
  };

  it('dispatches to the connector action and wraps the result as step output', async () => {
    dispatcher.execute.mockResolvedValue({ ts: '123.456', channel: '#general' });

    const result = await executor.execute(step, contextFixture());

    expect(dispatcher.execute).toHaveBeenCalledWith({
      provider: 'SLACK',
      actionName: 'post_message',
      input: { channel: '#general', text: 'Deal closed!' },
      connectionId: 'conn-1',
      signal: undefined,
    });
    expect(result.output).toEqual({ ts: '123.456', channel: '#general' });
  });

  it('passes through the step execution signal for cancellation', async () => {
    dispatcher.execute.mockResolvedValue({});
    const controller = new AbortController();

    await executor.execute(step, contextFixture({ signal: controller.signal }));

    expect(dispatcher.execute).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('propagates a dispatcher failure', async () => {
    dispatcher.execute.mockRejectedValue(new Error('Slack API error'));
    await expect(executor.execute(step, contextFixture())).rejects.toThrow('Slack API error');
  });

  it('throws when given a non-INTEGRATION step', async () => {
    const wrongStep: WorkflowStepDefinition = {
      id: 'wait',
      name: 'Wait',
      type: 'DELAY',
      config: { delayMs: 100 },
    };
    await expect(executor.execute(wrongStep, contextFixture())).rejects.toThrow(
      'non-INTEGRATION step',
    );
  });
});
