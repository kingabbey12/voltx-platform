import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { ActivitiesService } from '../activities/activities.service';
import { LeadsService } from '../leads/leads.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';

/**
 * Gives the AI agent runtime real, tenant-scoped access to sales data and
 * mutations by wrapping the exact same services the REST controllers call
 * (OpportunitiesService/ActivitiesService/LeadsService) — no parallel
 * business logic, no mock data. Tenant scoping comes for free: these
 * services read TenantContextService (AsyncLocalStorage) internally, and
 * a tool's execute() runs within the same request's async context as the
 * agent run that invoked it.
 *
 * Read tools (search_*) intentionally fetch a bounded page and filter
 * in-memory for predicates the underlying repositories don't expose as
 * query params (amount thresholds, overdue-by-date) — acceptable at
 * current data volumes; revisit with real repository-level filters if a
 * tenant's sales data grows large enough for this to matter.
 */
@Injectable()
export class SalesToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly activitiesService: ActivitiesService,
    private readonly leadsService: LeadsService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildSearchOpportunitiesTool(),
      this.buildSearchOverdueActivitiesTool(),
      this.buildCreateTaskTool(),
      this.buildSearchLeadsTool(),
    ];
  }

  private buildSearchOpportunitiesTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        minAmount: {
          type: 'number',
          description: 'Only include opportunities with amount >= this value.',
        },
        maxAmount: {
          type: 'number',
          description: 'Only include opportunities with amount <= this value.',
        },
        stage: {
          type: 'string',
          description:
            'Optional stage filter: DISCOVERY, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST.',
        },
      },
    };

    return {
      name: 'search_opportunities',
      description:
        'Search the CRM pipeline for opportunities, optionally filtered by minimum/maximum deal amount and stage. Returns id, title, stage, amount, currency, and expected close date for each match.',
      inputSchema: schema,
      async execute(input: { minAmount?: number; maxAmount?: number; stage?: string }) {
        const result = await opportunitiesService.findAll({
          page: 1,
          limit: 100,
          stage: input.stage,
        });

        const items = result.items.filter((item) => {
          if (input.minAmount != null && (item.amount ?? 0) < input.minAmount) return false;
          if (input.maxAmount != null && (item.amount ?? 0) > input.maxAmount) return false;
          return true;
        });

        return {
          total: items.length,
          opportunities: items.map((item) => ({
            id: item.id,
            title: item.title,
            stage: item.stage,
            amount: item.amount,
            currency: item.currency,
            expectedCloseAt: item.expectedCloseAt,
          })),
        };
      },
    };
  }

  private buildSearchOverdueActivitiesTool(): AITool {
    const activitiesService = this.activitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        minDaysOverdue: {
          type: 'number',
          description:
            'Only include activities whose due date was at least this many days ago. Default 0 (any overdue).',
        },
        type: {
          type: 'string',
          description: 'Optional activity type filter: CALL, EMAIL, MEETING, TASK, NOTE.',
        },
      },
    };

    return {
      name: 'search_overdue_activities',
      description:
        'Find incomplete CRM activities (calls, emails, meetings, tasks) whose due date has passed — e.g. "waiting more than 7 days". Returns id, subject, type, dueAt, and linked company/contact/lead/opportunity ids.',
      inputSchema: schema,
      async execute(input: { minDaysOverdue?: number; type?: string }) {
        const result = await activitiesService.findAll({
          page: 1,
          limit: 100,
          completed: false,
          type: input.type,
        });

        const now = Date.now();
        const minMs = (input.minDaysOverdue ?? 0) * 24 * 60 * 60 * 1000;

        const overdue = result.items.filter((item) => {
          if (!item.dueAt) return false;
          const dueAt = new Date(item.dueAt).getTime();
          return now - dueAt >= minMs;
        });

        return {
          total: overdue.length,
          activities: overdue.map((item) => ({
            id: item.id,
            subject: item.subject,
            type: item.type,
            dueAt: item.dueAt,
            companyId: item.companyId,
            contactId: item.contactId,
            leadId: item.leadId,
            opportunityId: item.opportunityId,
          })),
        };
      },
    };
  }

  private buildCreateTaskTool(): AITool {
    const activitiesService = this.activitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Short task title.', required: true },
        description: { type: 'string', description: 'Optional task details.' },
        dueAt: { type: 'string', description: 'Optional ISO 8601 due date/time.' },
        companyId: { type: 'string', description: 'Optional linked company id.' },
        contactId: { type: 'string', description: 'Optional linked contact id.' },
        leadId: { type: 'string', description: 'Optional linked lead id.' },
        opportunityId: { type: 'string', description: 'Optional linked opportunity id.' },
      },
    };

    return {
      name: 'create_task',
      description:
        'Create a real follow-up task (a CRM activity of type TASK) that will appear in the workspace. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        subject: string;
        description?: string;
        dueAt?: string;
        companyId?: string;
        contactId?: string;
        leadId?: string;
        opportunityId?: string;
      }) {
        if (!input.subject?.trim()) {
          throw new Error('subject is required');
        }

        const created = await activitiesService.create({
          type: 'TASK',
          subject: input.subject.trim(),
          description: input.description,
          dueAt: input.dueAt,
          companyId: input.companyId,
          contactId: input.contactId,
          leadId: input.leadId,
          opportunityId: input.opportunityId,
        });

        return { id: created.id, subject: created.subject, dueAt: created.dueAt };
      },
    };
  }

  private buildSearchLeadsTool(): AITool {
    const leadsService = this.leadsService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Optional status filter: NEW, QUALIFIED, NURTURING, DISQUALIFIED, CONVERTED.',
        },
      },
    };

    return {
      name: 'search_leads',
      description:
        'Search CRM leads, optionally filtered by status. Returns id, title, status, and qualification score for each match.',
      inputSchema: schema,
      async execute(input: { status?: string }) {
        const result = await leadsService.findAll({ page: 1, limit: 100, status: input.status });

        return {
          total: result.items.length,
          leads: result.items.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            qualificationScore: item.qualificationScore,
          })),
        };
      },
    };
  }
}
