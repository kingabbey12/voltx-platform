import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { WorkflowService } from '../workflow.service';
import { WorkflowDefinition } from '../definition/workflow-definition.types';

/**
 * Gives the AI agent runtime real access to workflow creation and failure
 * inspection by wrapping WorkflowService — the same service the REST
 * controller uses. Tenant/user scoping (organizationId, createdBy) comes
 * from TenantContextService (AsyncLocalStorage), already populated by the
 * time a tool's execute() runs within an agent run's request context.
 */
@Injectable()
export class WorkflowToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly workflowService: WorkflowService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [this.buildCreateWorkflowTool(), this.buildListFailedRunsTool()];
  }

  private buildCreateWorkflowTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name, must be unique in this organization.',
          required: true,
        },
        description: {
          type: 'string',
          description: 'Optional description of what this workflow does.',
        },
        objective: {
          type: 'string',
          description: "What the workflow's single AI step should accomplish, in plain language.",
          required: true,
        },
      },
    };

    return {
      name: 'create_simple_workflow',
      description:
        'Create a real single-step draft workflow with one AI reasoning step. This is a genuine, persisted workflow — it starts as DRAFT and must be published separately before it can run on a schedule.',
      inputSchema: schema,
      async execute(input: { name: string; description?: string; objective: string }) {
        if (!input.name?.trim() || !input.objective?.trim()) {
          throw new Error('name and objective are required');
        }

        const definition: WorkflowDefinition = {
          steps: [
            {
              id: 'step-1',
              name: input.name.trim(),
              type: 'AGENT',
              config: { agentName: 'Workflow Assistant', objective: input.objective.trim() },
            },
          ],
        };

        const workflow = await workflowService.createWorkflow({
          name: input.name.trim(),
          description: input.description?.trim(),
          definition,
        });

        return { id: workflow.id, name: workflow.name, status: workflow.status };
      },
    };
  }

  private buildListFailedRunsTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max number of failed runs to return, default 10, max 50.',
        },
      },
    };

    return {
      name: 'list_failed_workflow_runs',
      description:
        'List recent failed workflow runs across the organization, with the workflow name and error message for each.',
      inputSchema: schema,
      async execute(input: { limit?: number }) {
        const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));

        const [runsResult, workflowsResult] = await Promise.all([
          workflowService.listRuns({ page: 1, limit, status: 'FAILED' }),
          workflowService.listWorkflows({ page: 1, limit: 100 }),
        ]);

        const nameById = new Map(workflowsResult.items.map((w) => [w.id, w.name]));

        return {
          total: runsResult.items.length,
          failedRuns: runsResult.items.map((run) => ({
            runId: run.id,
            workflowId: run.workflowId,
            workflowName: nameById.get(run.workflowId) ?? 'Unknown workflow',
            error: run.error,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
          })),
        };
      },
    };
  }
}
