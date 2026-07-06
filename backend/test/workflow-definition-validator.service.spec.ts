import { WorkflowDefinitionValidatorService } from '../src/modules/workflows/definition/workflow-definition-validator.service';
import {
  AgentStepDefinition,
  ToolStepDefinition,
  WorkflowDefinition,
} from '../src/modules/workflows/definition/workflow-definition.types';

function agentStep(overrides: Partial<AgentStepDefinition> = {}): AgentStepDefinition {
  return {
    id: 'summarize',
    name: 'Summarize',
    type: 'AGENT',
    config: { agentName: 'Sales Assistant', objective: 'Summarize the deal.' },
    ...overrides,
  };
}

function toolStep(overrides: Partial<ToolStepDefinition> = {}): ToolStepDefinition {
  return {
    id: 'lookup',
    name: 'Lookup',
    type: 'TOOL',
    config: { toolName: 'datetime', input: {} },
    ...overrides,
  };
}

describe('WorkflowDefinitionValidatorService', () => {
  let service: WorkflowDefinitionValidatorService;

  beforeEach(() => {
    service = new WorkflowDefinitionValidatorService();
  });

  it('accepts a minimal valid definition', () => {
    const definition: WorkflowDefinition = { steps: [agentStep()] };
    expect(() => service.validate(definition)).not.toThrow();
  });

  it('rejects a definition with no steps', () => {
    expect(() => service.validate({ steps: [] })).toThrow(
      'Workflow definition must contain at least one step',
    );
  });

  it('rejects a step with an empty id', () => {
    const definition: WorkflowDefinition = { steps: [agentStep({ id: '' })] };
    expect(() => service.validate(definition)).toThrow('non-empty id');
  });

  it('rejects duplicate step ids', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ id: 'a' }), toolStep({ id: 'a' })],
    };
    expect(() => service.validate(definition)).toThrow('Duplicate workflow step id "a"');
  });

  it('rejects a step depending on itself', () => {
    const definition: WorkflowDefinition = { steps: [agentStep({ id: 'a', dependsOn: ['a'] })] };
    expect(() => service.validate(definition)).toThrow('cannot depend on itself');
  });

  it('rejects a step depending on an unknown step', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ id: 'a', dependsOn: ['missing'] })],
    };
    expect(() => service.validate(definition)).toThrow('depends on unknown step "missing"');
  });

  it('rejects a dependency cycle', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ id: 'a', dependsOn: ['b'] }), toolStep({ id: 'b', dependsOn: ['a'] })],
    };
    expect(() => service.validate(definition)).toThrow('dependency cycle');
  });

  it('accepts a valid parallel-branch diamond', () => {
    const definition: WorkflowDefinition = {
      steps: [
        agentStep({ id: 'start' }),
        toolStep({ id: 'branch-a', dependsOn: ['start'] }),
        toolStep({ id: 'branch-b', dependsOn: ['start'] }),
        agentStep({ id: 'join', dependsOn: ['branch-a', 'branch-b'] }),
      ],
    };
    expect(() => service.validate(definition)).not.toThrow();
  });

  it('rejects a condition with an empty path', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ condition: { path: '', operator: 'truthy' } })],
    };
    expect(() => service.validate(definition)).toThrow('empty path');
  });

  it('rejects a compensation hook with no toolName', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ compensation: { toolName: '', input: {} } })],
    };
    expect(() => service.validate(definition)).toThrow('no toolName');
  });

  it('rejects a retryPolicy with maxAttempts below 1', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ retryPolicy: { maxAttempts: 0, backoffMs: 100 } })],
    };
    expect(() => service.validate(definition)).toThrow('maxAttempts must be >= 1');
  });

  it('rejects a retryPolicy with negative backoffMs', () => {
    const definition: WorkflowDefinition = {
      steps: [agentStep({ retryPolicy: { maxAttempts: 2, backoffMs: -1 } })],
    };
    expect(() => service.validate(definition)).toThrow('backoffMs must be >= 0');
  });

  describe('per-step-type config validation', () => {
    it('rejects an AGENT step missing agentName', () => {
      const definition: WorkflowDefinition = {
        steps: [agentStep({ config: { agentName: '', objective: 'x' } })],
      };
      expect(() => service.validate(definition)).toThrow('(AGENT) requires config.agentName');
    });

    it('rejects an AGENT step missing objective', () => {
      const definition: WorkflowDefinition = {
        steps: [agentStep({ config: { agentName: 'Sales Assistant', objective: '' } })],
      };
      expect(() => service.validate(definition)).toThrow('(AGENT) requires config.objective');
    });

    it('rejects a TOOL step missing toolName', () => {
      const definition: WorkflowDefinition = {
        steps: [toolStep({ config: { toolName: '', input: {} } })],
      };
      expect(() => service.validate(definition)).toThrow('(TOOL) requires config.toolName');
    });

    it('rejects an API step missing url', () => {
      const definition: WorkflowDefinition = {
        steps: [{ id: 'call', name: 'Call', type: 'API', config: { method: 'GET', url: '' } }],
      };
      expect(() => service.validate(definition)).toThrow('(API) requires config.url');
    });

    it('rejects a WEBHOOK step missing url', () => {
      const definition: WorkflowDefinition = {
        steps: [
          { id: 'notify', name: 'Notify', type: 'WEBHOOK', config: { url: '', payload: {} } },
        ],
      };
      expect(() => service.validate(definition)).toThrow('(WEBHOOK) requires config.url');
    });

    it('rejects a NOTIFICATION step missing message', () => {
      const definition: WorkflowDefinition = {
        steps: [
          {
            id: 'notify',
            name: 'Notify',
            type: 'NOTIFICATION',
            config: { channel: 'log', message: '' },
          },
        ],
      };
      expect(() => service.validate(definition)).toThrow('(NOTIFICATION) requires config.message');
    });

    it('rejects a webhook-channel NOTIFICATION step missing webhookUrl', () => {
      const definition: WorkflowDefinition = {
        steps: [
          {
            id: 'notify',
            name: 'Notify',
            type: 'NOTIFICATION',
            config: { channel: 'webhook', message: 'hi' },
          },
        ],
      };
      expect(() => service.validate(definition)).toThrow('requires config.webhookUrl');
    });

    it('rejects an APPROVAL step missing message', () => {
      const definition: WorkflowDefinition = {
        steps: [{ id: 'approve', name: 'Approve', type: 'APPROVAL', config: { message: '' } }],
      };
      expect(() => service.validate(definition)).toThrow('(APPROVAL) requires config.message');
    });

    it('rejects a DELAY step with a non-positive delayMs', () => {
      const definition: WorkflowDefinition = {
        steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 0 } }],
      };
      expect(() => service.validate(definition)).toThrow('(DELAY) requires config.delayMs');
    });
  });
});
