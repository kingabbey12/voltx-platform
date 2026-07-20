import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { mutationGrounding, searchGrounding } from '../../ai/tools/grounding.helpers';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { NotificationService } from '../../notifications/notification.service';
import { ActivitiesService } from '../activities/activities.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { OpportunityStage } from '../opportunities/entities/opportunity.entity';

const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];

/**
 * Gives the AI agent runtime (and, via the TOOL step type, workflows) real,
 * tenant-scoped access to sales data and mutations by wrapping the exact
 * same services the REST controllers call (Opportunities/Activities/Leads/
 * Contacts/CompaniesService/NotificationService) — no parallel business
 * logic, no mock data. Tenant scoping comes for free: these services read
 * TenantContextService (AsyncLocalStorage) internally, and a tool's
 * execute() runs within the same request/run's async context as the
 * caller.
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
    private readonly contactsService: ContactsService,
    private readonly companiesService: CompaniesService,
    private readonly notificationService: NotificationService,
    private readonly tenantContextService: TenantContextService,
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
      this.buildCreateContactTool(),
      this.buildUpdateContactTool(),
      this.buildDeleteContactTool(),
      this.buildCreateCompanyTool(),
      this.buildUpdateCompanyTool(),
      this.buildCreateDealTool(),
      this.buildUpdateDealTool(),
      this.buildMovePipelineStageTool(),
      this.buildAssignTaskTool(),
      this.buildAddNoteTool(),
      this.buildSendNotificationTool(),
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
      ground(_input, output) {
        const data = output as {
          total: number;
          opportunities: Array<{ id: string; title: string }>;
        };
        return {
          summary:
            data.total === 0
              ? 'No matching opportunities in the pipeline'
              : `Read ${data.total} ${data.total === 1 ? 'opportunity' : 'opportunities'} from the pipeline`,
          records: data.opportunities.map((opportunity) => ({
            type: 'sales.opportunity',
            id: opportunity.id,
            label: opportunity.title,
          })),
          events: [],
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
      ground(_input, output) {
        const data = output as {
          total: number;
          activities: Array<{ id: string; subject: string }>;
        };
        return {
          summary:
            data.total === 0
              ? 'Nothing is overdue'
              : `Read ${data.total} overdue ${data.total === 1 ? 'activity' : 'activities'}`,
          records: data.activities.map((activity) => ({
            type: 'sales.activity',
            id: activity.id,
            label: activity.subject,
          })),
          events: [],
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
      ground: mutationGrounding<{ id: string; subject: string }>({
        recordType: 'sales.activity',
        action: 'Created task',
        record: (output) => ({ id: output.id, label: output.subject }),
      }),
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
      ground: searchGrounding<{ leads: Array<{ id: string; title: string }> }>({
        recordType: 'sales.lead',
        noun: ['lead', 'leads'],
        items: (output) => output.leads.map((lead) => ({ id: lead.id, label: lead.title })),
      }),
    };
  }

  private buildCreateContactTool(): AITool {
    const contactsService = this.contactsService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'Contact first name.', required: true },
        lastName: { type: 'string', description: 'Contact last name.', required: true },
        email: { type: 'string', description: 'Optional email address.' },
        phone: { type: 'string', description: 'Optional phone number.' },
        jobTitle: { type: 'string', description: 'Optional job title.' },
        companyId: { type: 'string', description: 'Optional linked company id.' },
        notes: { type: 'string', description: 'Optional freeform notes.' },
      },
    };

    return {
      name: 'create_contact',
      description: 'Create a real CRM contact. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        jobTitle?: string;
        companyId?: string;
        notes?: string;
      }) {
        if (!input.firstName?.trim() || !input.lastName?.trim()) {
          throw new Error('firstName and lastName are required');
        }
        const created = await contactsService.create({
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email,
          phone: input.phone,
          jobTitle: input.jobTitle,
          companyId: input.companyId,
          notes: input.notes,
        });
        return { id: created.id, firstName: created.firstName, lastName: created.lastName };
      },
      ground: mutationGrounding<{ id: string; firstName: string; lastName: string }>({
        recordType: 'sales.contact',
        action: 'Created contact',
        record: (output) => ({
          id: output.id,
          label: `${output.firstName} ${output.lastName}`.trim(),
        }),
      }),
    };
  }

  private buildUpdateContactTool(): AITool {
    const contactsService = this.contactsService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Id of the contact to update.', required: true },
        firstName: { type: 'string', description: 'New first name.' },
        lastName: { type: 'string', description: 'New last name.' },
        email: { type: 'string', description: 'New email address.' },
        phone: { type: 'string', description: 'New phone number.' },
        jobTitle: { type: 'string', description: 'New job title.' },
        notes: { type: 'string', description: 'New freeform notes.' },
      },
    };

    return {
      name: 'update_contact',
      description: 'Update an existing CRM contact. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        contactId: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        jobTitle?: string;
        notes?: string;
      }) {
        if (!input.contactId?.trim()) {
          throw new Error('contactId is required');
        }
        const { contactId, ...updates } = input;
        const updated = await contactsService.update(contactId, updates);
        return { id: updated.id, firstName: updated.firstName, lastName: updated.lastName };
      },
      ground: mutationGrounding<{ id: string; firstName: string; lastName: string }>({
        recordType: 'sales.contact',
        action: 'Updated contact',
        record: (output) => ({
          id: output.id,
          label: `${output.firstName} ${output.lastName}`.trim(),
        }),
      }),
    };
  }

  private buildDeleteContactTool(): AITool {
    const contactsService = this.contactsService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Id of the contact to delete.', required: true },
      },
    };

    return {
      name: 'delete_contact',
      description: 'Delete a CRM contact. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: { contactId: string }) {
        if (!input.contactId?.trim()) {
          throw new Error('contactId is required');
        }
        const deleted = await contactsService.remove(input.contactId);
        return { id: deleted.id, deleted: true };
      },
      ground: mutationGrounding<{ id: string }>({
        recordType: 'sales.contact',
        action: 'Deleted contact',
        record: (output) => ({ id: output.id, label: 'the contact' }),
      }),
    };
  }

  private buildCreateCompanyTool(): AITool {
    const companiesService = this.companiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name.', required: true },
        domain: { type: 'string', description: 'Optional company domain.' },
        website: { type: 'string', description: 'Optional company website URL.' },
        industry: { type: 'string', description: 'Optional industry.' },
        status: { type: 'string', description: 'Optional status: PROSPECT, ACTIVE, INACTIVE.' },
      },
    };

    return {
      name: 'create_company',
      description: 'Create a real CRM company. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        name: string;
        domain?: string;
        website?: string;
        industry?: string;
        status?: 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
      }) {
        if (!input.name?.trim()) {
          throw new Error('name is required');
        }
        const created = await companiesService.create({
          name: input.name.trim(),
          domain: input.domain,
          website: input.website,
          industry: input.industry,
          status: input.status,
        });
        return { id: created.id, name: created.name };
      },
      ground: mutationGrounding<{ id: string; name: string }>({
        recordType: 'sales.company',
        action: 'Created company',
        record: (output) => ({ id: output.id, label: output.name }),
      }),
    };
  }

  private buildUpdateCompanyTool(): AITool {
    const companiesService = this.companiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'Id of the company to update.', required: true },
        name: { type: 'string', description: 'New company name.' },
        domain: { type: 'string', description: 'New company domain.' },
        website: { type: 'string', description: 'New company website URL.' },
        industry: { type: 'string', description: 'New industry.' },
        status: { type: 'string', description: 'New status: PROSPECT, ACTIVE, INACTIVE.' },
      },
    };

    return {
      name: 'update_company',
      description: 'Update an existing CRM company. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        companyId: string;
        name?: string;
        domain?: string;
        website?: string;
        industry?: string;
        status?: 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
      }) {
        if (!input.companyId?.trim()) {
          throw new Error('companyId is required');
        }
        const { companyId, ...updates } = input;
        const updated = await companiesService.update(companyId, updates);
        return { id: updated.id, name: updated.name };
      },
      ground: mutationGrounding<{ id: string; name: string }>({
        recordType: 'sales.company',
        action: 'Updated company',
        record: (output) => ({ id: output.id, label: output.name }),
      }),
    };
  }

  private buildCreateDealTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deal/opportunity title.', required: true },
        companyId: { type: 'string', description: 'Optional linked company id.' },
        contactId: { type: 'string', description: 'Optional linked contact id.' },
        leadId: { type: 'string', description: 'Optional linked lead id.' },
        stage: {
          type: 'string',
          description: `Optional stage: ${OPPORTUNITY_STAGES.join(', ')}. Defaults to DISCOVERY.`,
        },
        amount: { type: 'number', description: 'Optional deal amount.' },
        currency: { type: 'string', description: 'Optional currency code, e.g. USD.' },
        expectedCloseAt: { type: 'string', description: 'Optional ISO 8601 expected close date.' },
      },
    };

    return {
      name: 'create_deal',
      description:
        'Create a real CRM deal (sales opportunity). This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        title: string;
        companyId?: string;
        contactId?: string;
        leadId?: string;
        stage?: string;
        amount?: number;
        currency?: string;
        expectedCloseAt?: string;
      }) {
        if (!input.title?.trim()) {
          throw new Error('title is required');
        }
        if (input.stage && !OPPORTUNITY_STAGES.includes(input.stage as OpportunityStage)) {
          throw new Error(`stage must be one of: ${OPPORTUNITY_STAGES.join(', ')}`);
        }
        const created = await opportunitiesService.create({
          title: input.title.trim(),
          companyId: input.companyId,
          contactId: input.contactId,
          leadId: input.leadId,
          stage: input.stage as OpportunityStage | undefined,
          amount: input.amount,
          currency: input.currency,
          expectedCloseAt: input.expectedCloseAt,
        });
        return { id: created.id, title: created.title, stage: created.stage };
      },
      ground: mutationGrounding<{ id: string; title: string }>({
        recordType: 'sales.opportunity',
        action: 'Created deal',
        record: (output) => ({ id: output.id, label: output.title }),
      }),
    };
  }

  private buildUpdateDealTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'Id of the deal to update.', required: true },
        title: { type: 'string', description: 'New title.' },
        amount: { type: 'number', description: 'New deal amount.' },
        currency: { type: 'string', description: 'New currency code.' },
        probability: { type: 'number', description: 'New probability (0-100).' },
        expectedCloseAt: { type: 'string', description: 'New ISO 8601 expected close date.' },
      },
    };

    return {
      name: 'update_deal',
      description: 'Update an existing CRM deal. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        dealId: string;
        title?: string;
        amount?: number;
        currency?: string;
        probability?: number;
        expectedCloseAt?: string;
      }) {
        if (!input.dealId?.trim()) {
          throw new Error('dealId is required');
        }
        const { dealId, ...updates } = input;
        const updated = await opportunitiesService.update(dealId, updates);
        return { id: updated.id, title: updated.title, stage: updated.stage };
      },
      ground: mutationGrounding<{ id: string; title: string }>({
        recordType: 'sales.opportunity',
        action: 'Updated deal',
        record: (output) => ({ id: output.id, label: output.title }),
      }),
    };
  }

  private buildMovePipelineStageTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'Id of the deal to move.', required: true },
        stage: {
          type: 'string',
          description: `New stage: ${OPPORTUNITY_STAGES.join(', ')}.`,
          required: true,
        },
      },
    };

    return {
      name: 'move_pipeline_stage',
      description:
        'Move a CRM deal to a different pipeline stage. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: { dealId: string; stage: string }) {
        if (!input.dealId?.trim()) {
          throw new Error('dealId is required');
        }
        if (!OPPORTUNITY_STAGES.includes(input.stage as OpportunityStage)) {
          throw new Error(`stage must be one of: ${OPPORTUNITY_STAGES.join(', ')}`);
        }
        const updated = await opportunitiesService.update(input.dealId, {
          stage: input.stage as OpportunityStage,
        });
        return { id: updated.id, title: updated.title, stage: updated.stage };
      },
      ground: mutationGrounding<{ id: string; title: string; stage: string }>({
        recordType: 'sales.opportunity',
        action: 'Moved deal stage',
        record: (output) => ({ id: output.id, label: `${output.title} → ${output.stage}` }),
      }),
    };
  }

  /**
   * There is no first-class assignee/owner field on Activity today (a
   * confirmed, deliberately-deferred-to-a-later-release gap — see the
   * v1.9.1 production audit's "no CRM record has an owner" finding).
   * Rather than fabricate one or fake this action, it's implemented as a
   * real, persisted write to Activity's existing generic `metadata` JSON
   * field — genuine data, just not yet a dedicated column.
   */
  private buildAssignTaskTool(): AITool {
    const activitiesService = this.activitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Id of the task (activity) to assign.',
          required: true,
        },
        assigneeUserId: {
          type: 'string',
          description: 'User id to assign the task to.',
          required: true,
        },
      },
    };

    return {
      name: 'assign_task',
      description:
        "Assign an existing CRM task to a user (stored on the task's metadata — see tool source comment for why).",
      inputSchema: schema,
      async execute(input: { taskId: string; assigneeUserId: string }) {
        if (!input.taskId?.trim() || !input.assigneeUserId?.trim()) {
          throw new Error('taskId and assigneeUserId are required');
        }
        const updated = await activitiesService.update(input.taskId, {
          metadata: { assigneeUserId: input.assigneeUserId },
        });
        return { id: updated.id, subject: updated.subject };
      },
      ground: mutationGrounding<{ id: string; subject: string }>({
        recordType: 'sales.activity',
        action: 'Assigned task',
        record: (output) => ({ id: output.id, label: output.subject }),
      }),
    };
  }

  private buildAddNoteTool(): AITool {
    const activitiesService = this.activitiesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Note text.', required: true },
        companyId: { type: 'string', description: 'Optional linked company id.' },
        contactId: { type: 'string', description: 'Optional linked contact id.' },
        leadId: { type: 'string', description: 'Optional linked lead id.' },
        opportunityId: { type: 'string', description: 'Optional linked deal id.' },
      },
    };

    return {
      name: 'add_note',
      description:
        'Add a real CRM note (a NOTE-type activity) linked to a company/contact/lead/deal. This is a genuine, persisted mutation.',
      inputSchema: schema,
      async execute(input: {
        note: string;
        companyId?: string;
        contactId?: string;
        leadId?: string;
        opportunityId?: string;
      }) {
        if (!input.note?.trim()) {
          throw new Error('note is required');
        }
        const created = await activitiesService.create({
          type: 'NOTE',
          subject: input.note.trim().slice(0, 200),
          description: input.note.trim(),
          companyId: input.companyId,
          contactId: input.contactId,
          leadId: input.leadId,
          opportunityId: input.opportunityId,
        });
        return { id: created.id, subject: created.subject };
      },
      ground: mutationGrounding<{ id: string; subject: string }>({
        recordType: 'sales.activity',
        action: 'Added note',
        record: (output) => ({ id: output.id, label: output.subject }),
      }),
    };
  }

  private buildSendNotificationTool(): AITool {
    const notificationService = this.notificationService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Id of the user to notify.', required: true },
        title: { type: 'string', description: 'Notification title.', required: true },
        body: { type: 'string', description: 'Optional notification body.' },
        actionUrl: {
          type: 'string',
          description: 'Optional in-app URL the notification links to.',
        },
      },
    };

    return {
      name: 'send_notification',
      description:
        'Send a real, persisted, realtime-delivered in-app notification to a specific user. This is a genuine mutation, not a simulated/log-only alert.',
      inputSchema: schema,
      async execute(input: { userId: string; title: string; body?: string; actionUrl?: string }) {
        if (!input.userId?.trim() || !input.title?.trim()) {
          throw new Error('userId and title are required');
        }
        const { organizationId } = tenantContextService.getOrThrow();
        const created = await notificationService.create({
          organizationId,
          userId: input.userId,
          category: 'CRM',
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl,
        });
        return { id: created.id, title: input.title };
      },
      ground: mutationGrounding<{ id: string; title: string }>({
        recordType: 'notification',
        action: 'Sent notification',
        record: (output) => ({ id: output.id, label: output.title }),
      }),
    };
  }
}
