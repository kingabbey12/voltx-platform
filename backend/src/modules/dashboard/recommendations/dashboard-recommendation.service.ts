import { Injectable } from '@nestjs/common';
import {
  DashboardRecommendationActionType,
  DashboardRecommendationCategory,
  DashboardRecommendationSeverity,
} from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { DashboardRecommendationRepository } from './dashboard-recommendation.repository';
import {
  DeterministicRecommendation,
  RecommendationEvidence,
  RecommendationView,
} from './dashboard-recommendation.types';

const STALE_ACTIVITY_DAYS = 14;
const HIGH_VALUE_THRESHOLD = 10_000;

@Injectable()
export class DashboardRecommendationService {
  private readonly refreshedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly recommendations: DashboardRecommendationRepository,
  ) {}

  async getRecommendations(limit = 20): Promise<RecommendationView[]> {
    await this.refreshDeterministicSignals();
    return this.recommendations.listActive(limit);
  }

  async getRecommendation(id: string): Promise<RecommendationView> {
    return this.recommendations.findById(id);
  }

  async getBrief(): Promise<{
    summary: string;
    generatedAt: string;
    dataFreshness: string;
    changes: RecommendationView[];
    wins: Array<{ title: string; href: string }>;
    risks: RecommendationView[];
    recommendedNextActions: RecommendationView[];
  }> {
    const recommendations = await this.getRecommendations(10);
    const wins = await this.prisma.scoped.salesOpportunity.findMany({
      where: {
        deletedAt: null,
        stage: 'CLOSED_WON',
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });
    const risks = recommendations.filter(
      (recommendation) =>
        recommendation.severity === 'CRITICAL' || recommendation.severity === 'WARNING',
    );
    return {
      summary:
        recommendations.length === 0
          ? 'No current business conditions matched the configured attention rules.'
          : `${recommendations.length} business condition${recommendations.length === 1 ? '' : 's'} need attention.`,
      generatedAt: new Date().toISOString(),
      dataFreshness: 'Live transactional data',
      changes: recommendations,
      wins: wins.map((win) => ({
        title: `Won: ${win.title}`,
        href: `/crm/opportunities/${win.id}`,
      })),
      risks,
      recommendedNextActions: recommendations.filter(
        (recommendation) => recommendation.actions.length > 0,
      ),
    };
  }

  async approve(id: string): Promise<RecommendationView> {
    return this.recommendations.approve(id);
  }

  async dismiss(id: string): Promise<void> {
    await this.recommendations.dismiss(id);
  }

  async reserveAction(recommendationId: string, actionId: string) {
    return this.recommendations.reserveAction(recommendationId, actionId);
  }

  async completeAction(
    recommendationId: string,
    actionId: string,
    result: Record<string, unknown>,
  ) {
    await this.recommendations.completeAction(recommendationId, actionId, result);
  }

  async releaseAction(recommendationId: string, actionId: string) {
    await this.recommendations.releaseAction(recommendationId, actionId);
  }

  private async refreshDeterministicSignals(): Promise<void> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const now = Date.now();
    if ((this.refreshedAt.get(organizationId) ?? 0) > now - 30_000) return;

    const signals = await this.collectSignals();
    await Promise.all(signals.map((signal) => this.recommendations.upsertDeterministic(signal)));
    await this.recommendations.markMissingDeterministicSignalsStale(
      signals.map((signal) => signal.fingerprint),
    );
    this.refreshedAt.set(organizationId, now);
  }

  private async collectSignals(): Promise<DeterministicRecommendation[]> {
    const cutoff = new Date(Date.now() - STALE_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [opportunities, qualifiedLeads, overdueTasks] = await Promise.all([
      this.prisma.scoped.salesOpportunity.findMany({
        where: {
          deletedAt: null,
          stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        },
        include: {
          activities: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.scoped.salesLead.findMany({
        where: { deletedAt: null, status: 'QUALIFIED' },
        include: {
          activities: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.scoped.salesActivity.findMany({
        where: {
          deletedAt: null,
          type: 'TASK',
          completed: false,
          dueAt: { lt: new Date() },
          opportunity: { is: { deletedAt: null, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } },
        },
        include: { opportunity: true },
      }),
    ]);

    const signals: DeterministicRecommendation[] = [];
    for (const opportunity of opportunities) {
      const lastActivity = opportunity.activities[0]?.createdAt ?? null;
      const stale = !lastActivity || lastActivity < cutoff;
      const evidence = [
        opportunityEvidence(opportunity.id, opportunity.title, lastActivity, cutoff),
      ];

      if ((opportunity.amount ?? 0) >= HIGH_VALUE_THRESHOLD && stale) {
        signals.push(
          taskRecommendation({
            fingerprint: `stale-high-value-opportunity:${opportunity.id}`,
            severity: DashboardRecommendationSeverity.WARNING,
            title: `Re-engage ${opportunity.title}`,
            summary: `A high-value opportunity has had no recorded activity for ${STALE_ACTIVITY_DAYS} days.`,
            explanation: evidence[0].reason,
            businessImpact: `${formatCurrency(opportunity.amount, opportunity.currency)} of pipeline could slip without an owner follow-up.`,
            opportunityId: opportunity.id,
            evidence,
          }),
        );
      }

      if (opportunity.expectedCloseAt && opportunity.expectedCloseAt <= soon && stale) {
        signals.push(
          taskRecommendation({
            fingerprint: `close-date-risk:${opportunity.id}`,
            severity: DashboardRecommendationSeverity.CRITICAL,
            title: `Confirm close plan for ${opportunity.title}`,
            summary:
              'An opportunity is approaching its expected close date without recent progress.',
            explanation: `${evidence[0].reason} The expected close date is ${opportunity.expectedCloseAt.toISOString().slice(0, 10)}.`,
            businessImpact:
              'The forecast may overstate expected revenue unless the close plan is reconfirmed.',
            opportunityId: opportunity.id,
            evidence,
          }),
        );
      }
    }

    for (const lead of qualifiedLeads) {
      const lastActivity = lead.activities[0]?.createdAt ?? null;
      if (lastActivity && lastActivity >= cutoff) continue;
      const evidence: RecommendationEvidence[] = [
        {
          type: 'lead',
          recordId: lead.id,
          recordLabel: lead.title,
          reason: lastActivity
            ? `Qualified lead has no recorded follow-up since ${lastActivity.toISOString().slice(0, 10)}.`
            : 'Qualified lead has no recorded follow-up activity.',
          href: `/crm/leads/${lead.id}`,
        },
      ];
      signals.push({
        fingerprint: `qualified-lead-without-follow-up:${lead.id}`,
        category: DashboardRecommendationCategory.SALES,
        severity: DashboardRecommendationSeverity.OPPORTUNITY,
        title: `Follow up with qualified lead: ${lead.title}`,
        summary: 'A qualified lead needs a next contact.',
        explanation: evidence[0].reason,
        businessImpact:
          'Prompt follow-up preserves conversion momentum while intent is still current.',
        recommendedNextStep: 'Create a follow-up task for the lead owner.',
        confidence: 1,
        evidence,
        actions: [createTaskAction(`Follow up with ${lead.title}`, { leadId: lead.id })],
        metadata: { rule: 'qualified-lead-without-follow-up', leadId: lead.id },
      });
    }

    for (const task of overdueTasks) {
      if (!task.opportunity) continue;
      const evidence: RecommendationEvidence[] = [
        {
          type: 'activity',
          recordId: task.id,
          recordLabel: task.subject,
          reason: `Task was due on ${task.dueAt?.toISOString().slice(0, 10)} and remains incomplete on an active opportunity.`,
          href: `/crm/activities/${task.id}`,
        },
      ];
      signals.push({
        fingerprint: `overdue-opportunity-task:${task.id}`,
        category: DashboardRecommendationCategory.SALES,
        severity: DashboardRecommendationSeverity.WARNING,
        title: `Resolve overdue task: ${task.subject}`,
        summary: `An overdue task is blocking progress on ${task.opportunity.title}.`,
        explanation: evidence[0].reason,
        businessImpact: 'Missed follow-ups increase the chance of opportunity delay or loss.',
        recommendedNextStep: 'Create a replacement follow-up task and review the opportunity.',
        confidence: 1,
        evidence,
        actions: [
          createTaskAction(`Follow up: ${task.opportunity.title}`, {
            opportunityId: task.opportunityId ?? undefined,
          }),
        ],
        metadata: {
          rule: 'overdue-opportunity-task',
          activityId: task.id,
          opportunityId: task.opportunityId,
        },
      });
    }
    return signals;
  }
}

function taskRecommendation(input: {
  fingerprint: string;
  severity: DashboardRecommendationSeverity;
  title: string;
  summary: string;
  explanation: string;
  businessImpact: string;
  opportunityId: string;
  evidence: RecommendationEvidence[];
}): DeterministicRecommendation {
  return {
    ...input,
    category: DashboardRecommendationCategory.SALES,
    recommendedNextStep: 'Create a follow-up task and review the opportunity.',
    confidence: 1,
    actions: [
      createTaskAction(
        `Follow up: ${input.title.replace(/^(Re-engage|Confirm close plan for) /, '')}`,
        { opportunityId: input.opportunityId },
      ),
    ],
    metadata: { rule: input.fingerprint.split(':')[0], opportunityId: input.opportunityId },
  };
}

function createTaskAction(subject: string, links: { opportunityId?: string; leadId?: string }) {
  return {
    type: DashboardRecommendationActionType.CREATE_TASK,
    label: 'Create follow-up task',
    requiresApproval: true,
    payload: {
      subject,
      description: 'Created from an Executive Dashboard recommendation.',
      ...links,
    },
    idempotencyKey: `create-task:${links.opportunityId ?? links.leadId}:${subject}`,
  };
}

function opportunityEvidence(
  id: string,
  title: string,
  lastActivity: Date | null,
  cutoff: Date,
): RecommendationEvidence {
  return {
    type: 'opportunity',
    recordId: id,
    recordLabel: title,
    reason: lastActivity
      ? `No recorded activity since ${lastActivity.toISOString().slice(0, 10)}; the follow-up threshold was ${cutoff.toISOString().slice(0, 10)}.`
      : 'No recorded activity exists for this opportunity.',
    href: `/crm/opportunities/${id}`,
  };
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null) return 'Pipeline value';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
