import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface PlatformAlertResponse {
  id: string;
  status: string;
  acknowledgedById: string | null;
  resolvedById: string | null;
}

interface ResolvedFlagResponse {
  key: string;
  value: unknown;
  source: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface PlatformOrganizationSummary {
  id: string;
  memberCount: number;
}

interface PlatformUserDetail {
  id: string;
  memberships: { organizationId: string; roleName: string }[];
}

interface RevenueSummaryResponse {
  estimatedMonthlyRecurringRevenueUsd: number;
  totalRevenueCollectedUsd: number;
  outstandingAmountDueUsd: number;
}

interface SystemHealthResponse {
  dependencies: { database: { status: string } };
  queues: unknown[];
  commsDelivery: { totalMessages: number; failedMessages: number; failureRate: number };
}

async function promoteToPlatformAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.system.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
}

describe('Enterprise Platform Console (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('rejects every Platform Console endpoint for a normal (non-platform-admin) org owner', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-non-admin-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    await request(app.getHttpServer()).get('/api/v1/platform/alerts').set(auth).expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/feature-flags').set(auth).expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/organizations').set(auth).expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/users').set(auth).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/revenue/summary')
      .set(auth)
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/system-health').set(auth).expect(403);
  });

  it('runs a platform alert through its full acknowledge/resolve lifecycle', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-alerts-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);
    const auth = { Authorization: `Bearer ${admin.accessToken}` };

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/platform/alerts')
      .set(auth)
      .send({ severity: 'CRITICAL', category: 'queue', title: 'Backlog spike' })
      .expect(201);
    const alert = (createResponse.body as ApiSuccessResponse<PlatformAlertResponse>).data;
    expect(alert.status).toBe('OPEN');

    const ackResponse = await request(app.getHttpServer())
      .post(`/api/v1/platform/alerts/${alert.id}/acknowledge`)
      .set(auth)
      .expect(200);
    const acknowledged = (ackResponse.body as ApiSuccessResponse<PlatformAlertResponse>).data;
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(acknowledged.acknowledgedById).toBe(admin.user.id);

    const resolveResponse = await request(app.getHttpServer())
      .post(`/api/v1/platform/alerts/${alert.id}/resolve`)
      .set(auth)
      .expect(200);
    const resolved = (resolveResponse.body as ApiSuccessResponse<PlatformAlertResponse>).data;
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedById).toBe(admin.user.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/platform/alerts/${alert.id}`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/alerts/${alert.id}`)
      .set(auth)
      .expect(404);
  });

  it("resolves a feature flag's effective value in override-wins-over-default order", async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-flags-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);
    const auth = { Authorization: `Bearer ${admin.accessToken}` };
    const flagKey = `beta-feature-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/platform/feature-flags')
      .set(auth)
      .send({ key: flagKey, name: 'Beta Feature', type: 'BOOLEAN', defaultValue: false })
      .expect(201);

    const beforeOverride = await request(app.getHttpServer())
      .get(`/api/v1/platform/feature-flags/${flagKey}/resolve/${admin.organization.id}`)
      .set(auth)
      .expect(200);
    expect((beforeOverride.body as ApiSuccessResponse<ResolvedFlagResponse>).data).toEqual({
      key: flagKey,
      value: false,
      source: 'default',
    });

    await request(app.getHttpServer())
      .put(`/api/v1/platform/feature-flags/${flagKey}/overrides/${admin.organization.id}`)
      .set(auth)
      .send({ value: true })
      .expect(200);

    const afterOverride = await request(app.getHttpServer())
      .get(`/api/v1/platform/feature-flags/${flagKey}/resolve/${admin.organization.id}`)
      .set(auth)
      .expect(200);
    expect((afterOverride.body as ApiSuccessResponse<ResolvedFlagResponse>).data).toEqual({
      key: flagKey,
      value: true,
      source: 'override',
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/platform/feature-flags/${flagKey}/overrides/${admin.organization.id}`)
      .set(auth)
      .expect(200);

    const afterRemoval = await request(app.getHttpServer())
      .get(`/api/v1/platform/feature-flags/${flagKey}/resolve/${admin.organization.id}`)
      .set(auth)
      .expect(200);
    expect((afterRemoval.body as ApiSuccessResponse<ResolvedFlagResponse>).data.source).toBe(
      'default',
    );
  });

  it('rejects creating a feature flag whose default value does not match its declared type', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-flags-badtype-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);

    await request(app.getHttpServer())
      .post('/api/v1/platform/feature-flags')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key: `bad-${Date.now()}`, name: 'Bad', type: 'NUMBER', defaultValue: 'not-a-number' })
      .expect(400);
  });

  it('searches organizations and users across every tenant on the platform, not just the caller’s own', async () => {
    const orgAOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-org-a-${Date.now()}@example.com`,
    });
    const orgBOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-org-b-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, orgAOwner.user.id);
    const auth = { Authorization: `Bearer ${orgAOwner.accessToken}` };

    const orgSearchResponse = await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set(auth)
      .expect(200);
    const orgSearch = (
      orgSearchResponse.body as ApiSuccessResponse<PaginatedResponse<PlatformOrganizationSummary>>
    ).data;
    const foundOrgIds = orgSearch.items.map((item) => item.id);
    expect(foundOrgIds).toContain(orgAOwner.organization.id);
    expect(foundOrgIds).toContain(orgBOwner.organization.id);

    const orgDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${orgBOwner.organization.id}`)
      .set(auth)
      .expect(200);
    expect(
      (orgDetailResponse.body as ApiSuccessResponse<PlatformOrganizationSummary>).data.memberCount,
    ).toBe(1);

    const userSearchResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/users?search=${encodeURIComponent(orgBOwner.user.email)}`)
      .set(auth)
      .expect(200);
    const userSearch = (
      userSearchResponse.body as ApiSuccessResponse<PaginatedResponse<{ id: string }>>
    ).data;
    expect(userSearch.items.map((item) => item.id)).toContain(orgBOwner.user.id);

    const userDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/users/${orgBOwner.user.id}`)
      .set(auth)
      .expect(200);
    const userDetail = (userDetailResponse.body as ApiSuccessResponse<PlatformUserDetail>).data;
    expect(userDetail.memberships).toEqual([
      expect.objectContaining({ organizationId: orgBOwner.organization.id, roleName: 'Admin' }),
    ]);
  });

  it('returns a platform-wide revenue summary with numeric aggregates', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-revenue-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);

    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/revenue/summary')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const summary = (response.body as ApiSuccessResponse<RevenueSummaryResponse>).data;

    expect(typeof summary.estimatedMonthlyRecurringRevenueUsd).toBe('number');
    expect(typeof summary.totalRevenueCollectedUsd).toBe('number');
    expect(typeof summary.outstandingAmountDueUsd).toBe('number');
  });

  it('returns aggregated system health across database/redis, queues, and comms delivery', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `console-health-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);

    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/system-health')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const health = (response.body as ApiSuccessResponse<SystemHealthResponse>).data;

    expect(health.dependencies.database.status).toBe('up');
    expect(Array.isArray(health.queues)).toBe(true);
    expect(health.commsDelivery).toEqual({ totalMessages: 0, failedMessages: 0, failureRate: 0 });
  });
});
