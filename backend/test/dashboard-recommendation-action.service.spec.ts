import { ConflictException } from '@nestjs/common';
import { DashboardRecommendationActionService } from '../src/modules/dashboard/recommendations/dashboard-recommendation-action.service';
import type { DashboardRecommendationService } from '../src/modules/dashboard/recommendations/dashboard-recommendation.service';
import type { ActivitiesService } from '../src/modules/sales/activities/activities.service';
import type { AuditService } from '../src/modules/audit/audit.service';

const recommendation = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'APPROVED',
  actions: [],
};

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const recommendations = {
    getRecommendation: jest.fn().mockResolvedValue(recommendation),
    approve: jest.fn().mockResolvedValue(recommendation),
    dismiss: jest.fn().mockResolvedValue(undefined),
    reserveAction: jest.fn().mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      type: 'CREATE_TASK',
      label: 'Create follow-up task',
      requiresApproval: true,
      payload: {
        subject: 'Follow up with Acme',
        opportunityId: '33333333-3333-3333-3333-333333333333',
      },
      executedAt: null,
    }),
    completeAction: jest.fn().mockResolvedValue(undefined),
    releaseAction: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as DashboardRecommendationService;
  const activities = {
    createRecommendedTask: jest
      .fn()
      .mockResolvedValue({ id: '44444444-4444-4444-4444-444444444444' }),
  } as unknown as ActivitiesService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return {
    service: new DashboardRecommendationActionService(recommendations, activities, audit),
    recommendations,
    activities,
    audit,
  };
}

describe('DashboardRecommendationActionService', () => {
  it('requires an explicit approval before executing a task', async () => {
    const { service, activities } = buildService({
      getRecommendation: jest.fn().mockResolvedValue({ ...recommendation, status: 'OPEN' }),
    });

    await expect(
      service.execute(recommendation.id, '22222222-2222-2222-2222-222222222222'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(activities.createRecommendedTask).not.toHaveBeenCalled();
  });

  it('creates the canonical task once and audits the executed action', async () => {
    const { service, recommendations, activities, audit } = buildService();

    await expect(
      service.execute(recommendation.id, '22222222-2222-2222-2222-222222222222'),
    ).resolves.toEqual({ taskId: '44444444-4444-4444-4444-444444444444' });

    expect(activities.createRecommendedTask).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      expect.objectContaining({ subject: 'Follow up with Acme' }),
    );
    expect(recommendations.completeAction).toHaveBeenCalledWith(
      recommendation.id,
      '22222222-2222-2222-2222-222222222222',
      { taskId: '44444444-4444-4444-4444-444444444444' },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execute', resource: 'dashboard_recommendation_action' }),
    );
  });

  it('returns the previous task on an idempotent replay without creating another one', async () => {
    const actionId = '22222222-2222-2222-2222-222222222222';
    const { service, activities } = buildService({
      reserveAction: jest.fn().mockResolvedValue(null),
      getRecommendation: jest.fn().mockResolvedValue({
        ...recommendation,
        actions: [
          {
            id: actionId,
            executedAt: '2026-08-02T00:00:00.000Z',
            payload: { taskId: '44444444-4444-4444-4444-444444444444' },
          },
        ],
      }),
    });

    await expect(service.execute(recommendation.id, actionId)).resolves.toEqual({
      taskId: '44444444-4444-4444-4444-444444444444',
    });
    expect(activities.createRecommendedTask).not.toHaveBeenCalled();
  });

  it('audits both approval and dismissal', async () => {
    const { service, audit } = buildService();

    await service.approve(recommendation.id);
    await service.dismiss(recommendation.id);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approve', resource: 'dashboard_recommendation' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dismiss', resource: 'dashboard_recommendation' }),
    );
  });
});
