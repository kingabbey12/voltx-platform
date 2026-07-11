import { WorkflowToolSourceService } from '../src/modules/workflows/tools/workflow-tool-source.service';
import { AITool, ToolExecutionContext } from '../src/modules/ai/tools/tool.interface';

function toolContext(): ToolExecutionContext {
  return { conversationId: 'conversation-1', signal: new AbortController().signal };
}

describe('WorkflowToolSourceService', () => {
  let toolRegistry: { registerDynamicSource: jest.Mock };
  let workflowService: {
    createWorkflow: jest.Mock;
    publishWorkflow: jest.Mock;
    listRuns: jest.Mock;
    listWorkflows: jest.Mock;
    getWorkflowOrThrow: jest.Mock;
    listVersions: jest.Mock;
    updateWorkflow: jest.Mock;
    decideApproval: jest.Mock;
  };
  let workflowScheduleService: { createSchedule: jest.Mock };
  let workflowAiService: {
    generateWorkflowDefinition: jest.Mock;
    explainWorkflow: jest.Mock;
    debugWorkflow: jest.Mock;
    optimizeWorkflow: jest.Mock;
  };
  let tenantContextService: { getOrThrow: jest.Mock };
  let service: WorkflowToolSourceService;

  function findTool(name: string): AITool {
    const tool = service.listTools().find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() };
    workflowService = {
      createWorkflow: jest.fn(),
      publishWorkflow: jest.fn(),
      listRuns: jest.fn(),
      listWorkflows: jest.fn(),
      getWorkflowOrThrow: jest.fn(),
      listVersions: jest.fn(),
      updateWorkflow: jest.fn(),
      decideApproval: jest.fn(),
    };
    workflowScheduleService = { createSchedule: jest.fn() };
    workflowAiService = {
      generateWorkflowDefinition: jest.fn(),
      explainWorkflow: jest.fn(),
      debugWorkflow: jest.fn(),
      optimizeWorkflow: jest.fn(),
    };
    tenantContextService = { getOrThrow: jest.fn() };

    service = new WorkflowToolSourceService(
      toolRegistry as never,
      workflowService as never,
      workflowScheduleService as never,
      workflowAiService as never,
      tenantContextService as never,
    );
  });

  it('registers itself as a dynamic tool source on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('exposes every workflow AI tool', () => {
    const names = service.listTools().map((tool) => tool.name);
    expect(names).toEqual([
      'create_simple_workflow',
      'list_failed_workflow_runs',
      'list_workflows',
      'get_workflow_definition',
      'update_workflow_definition',
      'publish_workflow',
      'create_workflow_schedule',
      'decide_workflow_approval',
      'generate_workflow_from_description',
      'explain_workflow',
      'debug_workflow',
      'optimize_workflow',
    ]);
  });

  describe('list_workflows', () => {
    it('lists workflows via WorkflowService with defaults applied', async () => {
      workflowService.listWorkflows.mockResolvedValue({
        total: 1,
        items: [
          {
            id: 'wf-1',
            name: 'Lead follow-up',
            description: null,
            status: 'DRAFT',
            publishedVersion: null,
          },
        ],
      });

      const result = await findTool('list_workflows').execute({}, toolContext());

      expect(workflowService.listWorkflows).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        search: undefined,
      });
      expect(result).toEqual({
        total: 1,
        workflows: [
          {
            id: 'wf-1',
            name: 'Lead follow-up',
            description: null,
            status: 'DRAFT',
            publishedVersion: null,
          },
        ],
      });
    });
  });

  describe('get_workflow_definition', () => {
    it('returns the workflow plus its latest version’s definition', async () => {
      workflowService.getWorkflowOrThrow.mockResolvedValue({
        id: 'wf-1',
        name: 'Lead follow-up',
        description: null,
        status: 'PUBLISHED',
        publishedVersion: 2,
      });
      workflowService.listVersions.mockResolvedValue([
        { version: 1, definition: { steps: [] } },
        {
          version: 2,
          definition: { steps: [{ id: 's1', name: 'Step', type: 'DELAY', config: {} }] },
        },
      ]);

      const result = await findTool('get_workflow_definition').execute(
        { workflowId: 'wf-1' },
        toolContext(),
      );

      expect(result).toMatchObject({
        id: 'wf-1',
        latestVersion: 2,
        definition: { steps: [{ id: 's1', name: 'Step', type: 'DELAY', config: {} }] },
      });
    });
  });

  describe('update_workflow_definition', () => {
    it('replaces the definition via WorkflowService.updateWorkflow', async () => {
      const definition = {
        steps: [{ id: 's1', name: 'Step', type: 'DELAY' as const, config: { delayMs: 1 } }],
      };
      workflowService.updateWorkflow.mockResolvedValue({
        id: 'wf-1',
        name: 'Lead follow-up',
        status: 'DRAFT',
      });

      const result = await findTool('update_workflow_definition').execute(
        { workflowId: 'wf-1', definition },
        toolContext(),
      );

      expect(workflowService.updateWorkflow).toHaveBeenCalledWith('wf-1', { definition });
      expect(result).toEqual({ id: 'wf-1', name: 'Lead follow-up', status: 'DRAFT' });
    });
  });

  describe('publish_workflow', () => {
    it('publishes via WorkflowService.publishWorkflow', async () => {
      workflowService.publishWorkflow.mockResolvedValue({
        id: 'wf-1',
        status: 'PUBLISHED',
        publishedVersion: 1,
      });

      const result = await findTool('publish_workflow').execute(
        { workflowId: 'wf-1' },
        toolContext(),
      );

      expect(workflowService.publishWorkflow).toHaveBeenCalledWith('wf-1');
      expect(result).toEqual({ id: 'wf-1', status: 'PUBLISHED', publishedVersion: 1 });
    });
  });

  describe('create_workflow_schedule', () => {
    it('creates a schedule via WorkflowScheduleService', async () => {
      workflowScheduleService.createSchedule.mockResolvedValue({
        id: 'sched-1',
        triggerType: 'CRON',
        enabled: true,
        nextRunAt: null,
      });

      const result = await findTool('create_workflow_schedule').execute(
        { workflowId: 'wf-1', triggerType: 'CRON', cronExpression: '0 9 * * MON' },
        toolContext(),
      );

      expect(workflowScheduleService.createSchedule).toHaveBeenCalledWith({
        workflowId: 'wf-1',
        triggerType: 'CRON',
        cronExpression: '0 9 * * MON',
        delayMs: undefined,
        eventName: undefined,
      });
      expect(result).toEqual({
        id: 'sched-1',
        triggerType: 'CRON',
        enabled: true,
        nextRunAt: null,
      });
    });
  });

  describe('decide_workflow_approval', () => {
    it('decides using the current tenant user as the approver', async () => {
      tenantContextService.getOrThrow.mockReturnValue({ userId: 'user-1' });
      workflowService.decideApproval.mockResolvedValue({
        id: 'approval-1',
        status: 'APPROVED',
        decidedAt: '2026-01-01T00:00:00.000Z',
      });

      const result = await findTool('decide_workflow_approval').execute(
        { approvalId: 'approval-1', decision: 'APPROVED', comment: 'looks good' },
        toolContext(),
      );

      expect(workflowService.decideApproval).toHaveBeenCalledWith(
        'approval-1',
        'APPROVED',
        'user-1',
        'looks good',
      );
      expect(result).toEqual({
        id: 'approval-1',
        status: 'APPROVED',
        decidedAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('generate_workflow_from_description', () => {
    it('generates, validates, and creates a draft workflow', async () => {
      const definition = {
        steps: [{ id: 's1', name: 'Step', type: 'DELAY' as const, config: { delayMs: 1 } }],
      };
      workflowAiService.generateWorkflowDefinition.mockResolvedValue(definition);
      workflowService.createWorkflow.mockResolvedValue({
        id: 'wf-1',
        name: 'Generated',
        status: 'DRAFT',
      });

      const result = await findTool('generate_workflow_from_description').execute(
        { name: 'Generated', description: 'Wait then stop.' },
        toolContext(),
      );

      expect(workflowAiService.generateWorkflowDefinition).toHaveBeenCalledWith('Wait then stop.');
      expect(workflowService.createWorkflow).toHaveBeenCalledWith({
        name: 'Generated',
        definition,
      });
      expect(workflowService.publishWorkflow).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'wf-1', name: 'Generated', status: 'DRAFT', stepCount: 1 });
    });

    it('publishes immediately when publish is true', async () => {
      const definition = {
        steps: [{ id: 's1', name: 'Step', type: 'DELAY' as const, config: { delayMs: 1 } }],
      };
      workflowAiService.generateWorkflowDefinition.mockResolvedValue(definition);
      workflowService.createWorkflow.mockResolvedValue({
        id: 'wf-1',
        name: 'Generated',
        status: 'DRAFT',
      });
      workflowService.publishWorkflow.mockResolvedValue({
        id: 'wf-1',
        name: 'Generated',
        status: 'PUBLISHED',
      });

      const result = await findTool('generate_workflow_from_description').execute(
        { name: 'Generated', description: 'Wait then stop.', publish: true },
        toolContext(),
      );

      expect(workflowService.publishWorkflow).toHaveBeenCalledWith('wf-1');
      expect(result).toMatchObject({ status: 'PUBLISHED' });
    });

    it('rejects a blank description without calling the AI service', async () => {
      await expect(
        findTool('generate_workflow_from_description').execute(
          { name: 'Generated', description: '   ' },
          toolContext(),
        ),
      ).rejects.toThrow('name and description are required');
      expect(workflowAiService.generateWorkflowDefinition).not.toHaveBeenCalled();
    });
  });

  describe('explain_workflow / debug_workflow / optimize_workflow', () => {
    it('delegates to WorkflowAiService', async () => {
      workflowAiService.explainWorkflow.mockResolvedValue('It waits then stops.');
      workflowAiService.debugWorkflow.mockResolvedValue('Step s1 keeps timing out.');
      workflowAiService.optimizeWorkflow.mockResolvedValue('Run steps s2 and s3 in parallel.');

      await expect(
        findTool('explain_workflow').execute({ workflowId: 'wf-1' }, toolContext()),
      ).resolves.toEqual({ explanation: 'It waits then stops.' });
      await expect(
        findTool('debug_workflow').execute({ workflowId: 'wf-1' }, toolContext()),
      ).resolves.toEqual({ diagnosis: 'Step s1 keeps timing out.' });
      await expect(
        findTool('optimize_workflow').execute({ workflowId: 'wf-1' }, toolContext()),
      ).resolves.toEqual({ suggestions: 'Run steps s2 and s3 in parallel.' });

      expect(workflowAiService.explainWorkflow).toHaveBeenCalledWith('wf-1');
      expect(workflowAiService.debugWorkflow).toHaveBeenCalledWith('wf-1');
      expect(workflowAiService.optimizeWorkflow).toHaveBeenCalledWith('wf-1');
    });
  });
});
