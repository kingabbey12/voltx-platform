import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DashboardRecommendationActionType, DashboardRecommendationStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ActivitiesService } from '../../sales/activities/activities.service';
import { DashboardRecommendationService } from './dashboard-recommendation.service';

@Injectable()
export class DashboardRecommendationActionService {
  constructor(
    private readonly recommendations: DashboardRecommendationService,
    private readonly activities: ActivitiesService,
    private readonly auditService: AuditService,
  ) {}

  async approve(recommendationId: string) {
    const recommendation = await this.recommendations.approve(recommendationId);
    await this.auditService.record({
      action: 'approve',
      resource: 'dashboard_recommendation',
      resourceId: recommendationId,
      metadata: { status: recommendation.status },
    });
    return recommendation;
  }

  async dismiss(recommendationId: string): Promise<void> {
    await this.recommendations.dismiss(recommendationId);
    await this.auditService.record({
      action: 'dismiss',
      resource: 'dashboard_recommendation',
      resourceId: recommendationId,
    });
  }

  async execute(recommendationId: string, actionId: string): Promise<{ taskId: string }> {
    const recommendation = await this.recommendations.getRecommendation(recommendationId);
    if (recommendation.status !== DashboardRecommendationStatus.APPROVED) {
      throw new ConflictException('Recommendation approval is required before execution');
    }
    if (recommendation.staleAt) {
      throw new ConflictException('Recommendation is no longer current and cannot be executed');
    }

    const action = await this.recommendations.reserveAction(recommendationId, actionId);
    if (!action) {
      const existing = await this.recommendations.getRecommendation(recommendationId);
      const completed = existing.actions.find((candidate) => candidate.id === actionId);
      const taskId = completed?.payload.taskId;
      if (completed?.executedAt && typeof taskId === 'string') return { taskId };
      throw new ConflictException('Recommendation action is already being executed');
    }

    try {
      if (action.type !== DashboardRecommendationActionType.CREATE_TASK) {
        throw new UnprocessableEntityException(
          `Action type ${action.type} is not available in this release`,
        );
      }
      const payload = action.payload;
      if (typeof payload.subject !== 'string' || payload.subject.trim().length === 0) {
        throw new UnprocessableEntityException('Recommendation task action is missing a subject');
      }

      const task = await this.activities.createRecommendedTask(action.id, {
        subject: payload.subject,
        description: typeof payload.description === 'string' ? payload.description : undefined,
        opportunityId: stringOrUndefined(payload.opportunityId),
        leadId: stringOrUndefined(payload.leadId),
        contactId: stringOrUndefined(payload.contactId),
        companyId: stringOrUndefined(payload.companyId),
        dueAt: stringOrUndefined(payload.dueAt),
      });
      await this.recommendations.completeAction(recommendationId, actionId, { taskId: task.id });
      await this.auditService.record({
        action: 'execute',
        resource: 'dashboard_recommendation_action',
        resourceId: actionId,
        metadata: { recommendationId, actionType: action.type, taskId: task.id },
      });
      return { taskId: task.id };
    } catch (error) {
      await this.recommendations.releaseAction(recommendationId, actionId);
      throw error;
    }
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
