import { Injectable } from '@nestjs/common';
import { FinanceService } from '../../finance/finance.service';
import { ConversationService } from '../../communications/conversation/conversation.service';
import { NotificationService } from '../../notifications/notification.service';
import { ActivitiesService } from '../../sales/activities/activities.service';
import { LeadsService } from '../../sales/leads/leads.service';
import { OpportunitiesService } from '../../sales/opportunities/opportunities.service';
import { WorkflowService } from '../../workflows/workflow.service';
import { ExecutiveContextBuilder } from './context.builder';
import { ExecutiveContextItem, ExecutiveContextSource } from './context.types';

export interface ExecutiveContextProviderResult {
  source: ExecutiveContextSource;
  items: ExecutiveContextItem[];
  total: number;
}

export interface ExecutiveContextProvider {
  readonly source: ExecutiveContextSource;
  readonly requiredPermissions: string[];
  collect(permissions: readonly string[]): Promise<ExecutiveContextProviderResult>;
}

@Injectable()
export class CrmContextProvider implements ExecutiveContextProvider {
  readonly source = 'crm' as const;
  readonly requiredPermissions = ['sales.opportunity.read', 'sales.lead.read'];

  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly leadsService: LeadsService,
  ) {}

  async collect(permissions: readonly string[]): Promise<ExecutiveContextProviderResult> {
    const [opportunities, leads] = await Promise.all([
      permissions.includes('sales.opportunity.read')
        ? this.opportunitiesService.findAll({ page: 1, limit: 10 })
        : Promise.resolve({ items: [], total: 0 }),
      permissions.includes('sales.lead.read')
        ? this.leadsService.findAll({ page: 1, limit: 10 })
        : Promise.resolve({ items: [], total: 0 }),
    ]);
    const items: ExecutiveContextItem[] = [
      ...opportunities.items.map((item) => ({
        id: `opportunity:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.title, 'Opportunity'),
        priority: priorityFor(item.amount != null && item.amount >= 100000),
        amount: item.amount ?? undefined,
        occurredAt: item.expectedCloseAt ?? item.updatedAt,
        details: { type: 'opportunity', stage: item.stage, probability: item.probability },
      })),
      ...leads.items.map((item) => ({
        id: `lead:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.title, 'Lead'),
        priority: priorityFor(item.qualificationScore != null && item.qualificationScore >= 80),
        occurredAt: item.updatedAt,
        details: {
          type: 'lead',
          status: item.status,
          qualificationScore: item.qualificationScore,
        },
      })),
    ];
    return {
      source: this.source,
      total: opportunities.total + leads.total,
      items,
    };
  }
}

@Injectable()
export class FinanceContextProvider implements ExecutiveContextProvider {
  readonly source = 'finance' as const;
  readonly requiredPermissions = ['finance.transaction.read', 'finance.budget.read'];

  constructor(private readonly financeService: FinanceService) {}

  async collect(permissions: readonly string[]): Promise<ExecutiveContextProviderResult> {
    const [overview, transactions, budgets] = await Promise.all([
      permissions.includes('finance.transaction.read')
        ? this.financeService.getOverview()
        : Promise.resolve(null),
      permissions.includes('finance.transaction.read')
        ? this.financeService.findTransactions({ page: 1, limit: 20 })
        : Promise.resolve({ items: [], total: 0 }),
      permissions.includes('finance.budget.read')
        ? this.financeService.listBudgets()
        : Promise.resolve([]),
    ]);
    const items: ExecutiveContextItem[] = [
      ...(overview
        ? [
            {
              id: 'finance:current-month-overview',
              label: 'Current-month finance overview',
              priority: priorityFor(overview.pendingExpenses > 0 || overview.budgetVariance < 0),
              amount: overview.netCashFlow,
              occurredAt: overview.periodEnd,
              details: {
                type: 'finance_overview',
                monthlyRevenue: overview.income,
                expenses: overview.expenses,
                pendingExpenses: overview.pendingExpenses,
                budgetUtilization:
                  overview.budgetedExpenses === 0
                    ? 0
                    : Number((overview.expenses / overview.budgetedExpenses).toFixed(4)),
              },
            },
          ]
        : []),
      ...transactions.items.map((item) => ({
        id: `transaction:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.category, 'Financial transaction'),
        priority: priorityFor(item.status === 'PENDING'),
        amount: item.amount,
        occurredAt: item.occurredAt,
        details: { type: item.type, status: item.status, currency: item.currency },
      })),
      ...budgets.map((item) => ({
        id: `budget:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.name, 'Budget'),
        priority: 'medium' as const,
        amount: item.amount,
        occurredAt: item.periodEnd,
        details: { type: 'budget', currency: item.currency },
      })),
    ];
    return {
      source: this.source,
      total: transactions.total + budgets.length,
      items,
    };
  }
}

@Injectable()
export class OperationsContextProvider implements ExecutiveContextProvider {
  readonly source = 'operations' as const;
  readonly requiredPermissions = ['sales.activity.read', 'workflow.read', 'workflow.approve'];

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly workflowService: WorkflowService,
  ) {}

  async collect(permissions: readonly string[]): Promise<ExecutiveContextProviderResult> {
    const [activities, failedRuns, approvals] = await Promise.all([
      permissions.includes('sales.activity.read')
        ? this.activitiesService.findAll({ page: 1, limit: 20, completed: false })
        : Promise.resolve({ items: [], total: 0 }),
      permissions.includes('workflow.read')
        ? this.workflowService.listRuns({ page: 1, limit: 10, status: 'FAILED' })
        : Promise.resolve({ items: [], total: 0 }),
      permissions.includes('workflow.approve')
        ? this.workflowService.listPendingApprovals(1, 10)
        : Promise.resolve({ items: [], total: 0 }),
    ]);
    const items: ExecutiveContextItem[] = [
      ...activities.items.map((item) => ({
        id: `activity:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.subject, 'Open activity'),
        priority: priorityFor(item.dueAt !== null && new Date(item.dueAt) < new Date()),
        occurredAt: item.dueAt ?? item.updatedAt,
        details: { type: item.type, completed: item.completed },
      })),
      ...failedRuns.items.map((item) => ({
        id: `workflow-run:${item.id}`,
        label: 'Failed workflow run',
        priority: 'critical' as const,
        occurredAt: item.updatedAt.toISOString(),
        details: { type: 'workflow_failure', status: item.status },
      })),
      ...approvals.items.map((item) => ({
        id: `workflow-approval:${item.id}`,
        label: 'Pending workflow approval',
        priority: 'high' as const,
        occurredAt: item.createdAt.toISOString(),
        details: { type: 'workflow_approval', expiresAt: item.expiresAt?.toISOString() ?? null },
      })),
    ];
    return {
      source: this.source,
      total: activities.total + failedRuns.total + approvals.total,
      items,
    };
  }
}

@Injectable()
export class CommunicationsContextProvider implements ExecutiveContextProvider {
  readonly source = 'communications' as const;
  readonly requiredPermissions = ['communications.conversation.read'];

  constructor(private readonly conversationService: ConversationService) {}

  async collect(): Promise<ExecutiveContextProviderResult> {
    const [unread, important] = await Promise.all([
      this.conversationService.listConversations({ page: 1, limit: 10, unread: true }),
      this.conversationService.listConversations({ page: 1, limit: 10, priority: 'URGENT' }),
    ]);
    const unique = new Map([...important.items, ...unread.items].map((item) => [item.id, item]));
    return {
      source: this.source,
      total: unique.size,
      items: [...unique.values()].map((item) => ({
        id: `conversation:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.subject ?? item.channel, 'Conversation'),
        priority:
          item.priority === 'URGENT'
            ? 'critical'
            : item.priority === 'HIGH' || item.unread
              ? 'high'
              : 'medium',
        occurredAt: (item.lastMessageAt ?? item.updatedAt).toISOString(),
        details: {
          type: 'conversation',
          channel: item.channel,
          unread: item.unread,
          priority: item.priority,
        },
      })),
    };
  }
}

@Injectable()
export class NotificationsContextProvider implements ExecutiveContextProvider {
  readonly source = 'notifications' as const;
  readonly requiredPermissions = ['notification.read'];

  constructor(private readonly notificationService: NotificationService) {}

  async collect(): Promise<ExecutiveContextProviderResult> {
    const notifications = await this.notificationService.listForCurrentUser({
      page: 1,
      limit: 10,
      read: false,
    });
    return {
      source: this.source,
      total: notifications.total,
      items: notifications.items.map((item) => ({
        id: `notification:${item.id}`,
        label: ExecutiveContextBuilder.cleanLabel(item.title, 'Notification'),
        priority:
          item.category === 'SECURITY' || item.category === 'BILLING'
            ? 'critical'
            : item.category === 'WORKFLOW'
              ? 'high'
              : 'medium',
        occurredAt: item.createdAt.toISOString(),
        details: { type: 'notification', category: item.category, unread: !item.read },
      })),
    };
  }
}

function priorityFor(condition: boolean): ExecutiveContextItem['priority'] {
  return condition ? 'high' : 'medium';
}
