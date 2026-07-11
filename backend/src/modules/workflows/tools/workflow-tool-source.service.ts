import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { WorkflowService } from '../workflow.service';
import { WorkflowDefinition } from '../definition/workflow-definition.types';
import { WorkflowScheduleService } from '../scheduling/workflow-schedule.service';
import { WorkflowAiService } from '../ai/workflow-ai.service';

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
    private readonly workflowScheduleService: WorkflowScheduleService,
    private readonly workflowAiService: WorkflowAiService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildCreateWorkflowTool(),
      this.buildListFailedRunsTool(),
      this.buildListWorkflowsTool(),
      this.buildGetWorkflowDefinitionTool(),
      this.buildUpdateWorkflowDefinitionTool(),
      this.buildPublishWorkflowTool(),
      this.buildCreateWorkflowScheduleTool(),
      this.buildDecideWorkflowApprovalTool(),
      this.buildGenerateWorkflowFromDescriptionTool(),
      this.buildExplainWorkflowTool(),
      this.buildDebugWorkflowTool(),
      this.buildOptimizeWorkflowTool(),
    ];
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
        publish: {
          type: 'boolean',
          description:
            'If true, publish the workflow immediately after creating it so it can actually run (on its configured schedule/trigger, or manually via the workflows API). Defaults to false (stays DRAFT).',
        },
      },
    };

    return {
      name: 'create_simple_workflow',
      description:
        'Create a real single-step draft workflow with one AI reasoning step. This is a genuine, persisted workflow — it starts as DRAFT unless publish is set true, and can then run on a schedule or be triggered via the workflows API.',
      inputSchema: schema,
      async execute(input: {
        name: string;
        description?: string;
        objective: string;
        publish?: boolean;
      }) {
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

        let workflow = await workflowService.createWorkflow({
          name: input.name.trim(),
          description: input.description?.trim(),
          definition,
        });

        if (input.publish) {
          workflow = await workflowService.publishWorkflow(workflow.id);
        }

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

  private buildListWorkflowsTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Optional filter: DRAFT, PUBLISHED, or ARCHIVED.',
        },
        search: { type: 'string', description: 'Optional name search.' },
        limit: { type: 'number', description: 'Max results, default 20, max 100.' },
      },
    };

    return {
      name: 'list_workflows',
      description: 'List this organization’s workflows, optionally filtered by status or name.',
      inputSchema: schema,
      async execute(input: { status?: string; search?: string; limit?: number }) {
        const limit = Math.max(1, Math.min(100, Number(input.limit ?? 20)));
        const result = await workflowService.listWorkflows({
          page: 1,
          limit,
          status: input.status as never,
          search: input.search,
        });
        return {
          total: result.total,
          workflows: result.items.map((w) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            status: w.status,
            publishedVersion: w.publishedVersion,
          })),
        };
      },
    };
  }

  private buildGetWorkflowDefinitionTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Id of the workflow.', required: true },
      },
    };

    return {
      name: 'get_workflow_definition',
      description:
        'Get a workflow’s metadata and its latest version’s full step definition (steps, dependsOn, conditions, config).',
      inputSchema: schema,
      async execute(input: { workflowId: string }) {
        const workflow = await workflowService.getWorkflowOrThrow(input.workflowId);
        const versions = await workflowService.listVersions(input.workflowId);
        const latest = versions[versions.length - 1];
        return {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          publishedVersion: workflow.publishedVersion,
          latestVersion: latest?.version ?? null,
          definition: latest?.definition ?? { steps: [] },
        };
      },
    };
  }

  private buildUpdateWorkflowDefinitionTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to update.',
          required: true,
        },
        definition: {
          type: 'object',
          description:
            'Full replacement WorkflowDefinition ({ steps: [...] }). This creates a new version — it does not merge with the previous one.',
          required: true,
        },
      },
    };

    return {
      name: 'update_workflow_definition',
      description:
        'Replace a workflow’s step definition, creating a new version. The definition is validated (unique step ids, valid dependsOn, no cycles, required config per step type) before being saved — an invalid definition is rejected with a specific error.',
      inputSchema: schema,
      async execute(input: { workflowId: string; definition: WorkflowDefinition }) {
        const updated = await workflowService.updateWorkflow(input.workflowId, {
          definition: input.definition,
        });
        return { id: updated.id, name: updated.name, status: updated.status };
      },
    };
  }

  private buildPublishWorkflowTool(): AITool {
    const workflowService = this.workflowService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to publish.',
          required: true,
        },
      },
    };

    return {
      name: 'publish_workflow',
      description:
        'Publish a workflow’s latest version so it can actually run (manually, on schedule, or via webhook/event trigger).',
      inputSchema: schema,
      async execute(input: { workflowId: string }) {
        const workflow = await workflowService.publishWorkflow(input.workflowId);
        return {
          id: workflow.id,
          status: workflow.status,
          publishedVersion: workflow.publishedVersion,
        };
      },
    };
  }

  private buildCreateWorkflowScheduleTool(): AITool {
    const workflowScheduleService = this.workflowScheduleService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to schedule.',
          required: true,
        },
        triggerType: {
          type: 'string',
          description: 'One of: CRON, DELAYED, EVENT.',
          required: true,
        },
        cronExpression: {
          type: 'string',
          description: 'Required when triggerType is CRON, e.g. "0 9 * * MON".',
        },
        delayMs: { type: 'number', description: 'Required when triggerType is DELAYED.' },
        eventName: {
          type: 'string',
          description: 'Required when triggerType is EVENT, e.g. "SALES_OPPORTUNITY_CREATED".',
        },
      },
    };

    return {
      name: 'create_workflow_schedule',
      description:
        'Create a CRON, DELAYED, or EVENT-triggered schedule for a workflow so it runs automatically instead of only manually.',
      inputSchema: schema,
      async execute(input: {
        workflowId: string;
        triggerType: 'CRON' | 'DELAYED' | 'EVENT';
        cronExpression?: string;
        delayMs?: number;
        eventName?: string;
      }) {
        const schedule = await workflowScheduleService.createSchedule({
          workflowId: input.workflowId,
          triggerType: input.triggerType,
          cronExpression: input.cronExpression,
          delayMs: input.delayMs,
          eventName: input.eventName,
        });
        return {
          id: schedule.id,
          triggerType: schedule.triggerType,
          enabled: schedule.enabled,
          nextRunAt: schedule.nextRunAt,
        };
      },
    };
  }

  private buildDecideWorkflowApprovalTool(): AITool {
    const workflowService = this.workflowService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Id of the pending approval.', required: true },
        decision: { type: 'string', description: 'APPROVED or REJECTED.', required: true },
        comment: { type: 'string', description: 'Optional comment explaining the decision.' },
      },
    };

    return {
      name: 'decide_workflow_approval',
      description: 'Approve or reject a pending workflow approval step, resuming its run.',
      inputSchema: schema,
      async execute(input: {
        approvalId: string;
        decision: 'APPROVED' | 'REJECTED';
        comment?: string;
      }) {
        const tenant = tenantContextService.getOrThrow();
        const approval = await workflowService.decideApproval(
          input.approvalId,
          input.decision,
          tenant.userId,
          input.comment,
        );
        return { id: approval.id, status: approval.status, decidedAt: approval.decidedAt };
      },
    };
  }

  private buildGenerateWorkflowFromDescriptionTool(): AITool {
    const workflowService = this.workflowService;
    const workflowAiService = this.workflowAiService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the new workflow.', required: true },
        description: {
          type: 'string',
          description:
            'Plain-language description of the automation to build, e.g. "When a customer sends a WhatsApp message after business hours, summarize it, create a follow-up task, and notify the on-call rep."',
          required: true,
        },
        publish: {
          type: 'boolean',
          description:
            'If true, publish immediately after a valid definition is generated. Defaults to false (stays DRAFT).',
        },
      },
    };

    return {
      name: 'generate_workflow_from_description',
      description:
        'Generate a real, multi-step workflow definition from a natural-language description using AI, validate it, and create it as a workflow (DRAFT unless publish is true). If the first generation attempt fails validation, one automatic retry is made with the validation error fed back to the model; a persistent failure is reported rather than silently creating an invalid workflow.',
      inputSchema: schema,
      async execute(input: { name: string; description: string; publish?: boolean }) {
        if (!input.name?.trim() || !input.description?.trim()) {
          throw new Error('name and description are required');
        }

        const definition = await workflowAiService.generateWorkflowDefinition(
          input.description.trim(),
        );

        let workflow = await workflowService.createWorkflow({
          name: input.name.trim(),
          definition,
        });

        if (input.publish) {
          workflow = await workflowService.publishWorkflow(workflow.id);
        }

        return {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          stepCount: definition.steps.length,
        };
      },
    };
  }

  private buildExplainWorkflowTool(): AITool {
    const workflowAiService = this.workflowAiService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to explain.',
          required: true,
        },
      },
    };

    return {
      name: 'explain_workflow',
      description:
        'Get a plain-language explanation of what a workflow does, for a non-technical audience.',
      inputSchema: schema,
      async execute(input: { workflowId: string }) {
        const explanation = await workflowAiService.explainWorkflow(input.workflowId);
        return { explanation };
      },
    };
  }

  private buildDebugWorkflowTool(): AITool {
    const workflowAiService = this.workflowAiService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to diagnose.',
          required: true,
        },
      },
    };

    return {
      name: 'debug_workflow',
      description:
        'Diagnose likely causes of recent failures in a workflow, based on its definition and recent run history.',
      inputSchema: schema,
      async execute(input: { workflowId: string }) {
        const diagnosis = await workflowAiService.debugWorkflow(input.workflowId);
        return { diagnosis };
      },
    };
  }

  private buildOptimizeWorkflowTool(): AITool {
    const workflowAiService = this.workflowAiService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Id of the workflow to optimize.',
          required: true,
        },
      },
    };

    return {
      name: 'optimize_workflow',
      description:
        'Get concrete suggestions to improve a workflow’s reliability, speed, and cost, based on its definition and recent run history.',
      inputSchema: schema,
      async execute(input: { workflowId: string }) {
        const suggestions = await workflowAiService.optimizeWorkflow(input.workflowId);
        return { suggestions };
      },
    };
  }
}
