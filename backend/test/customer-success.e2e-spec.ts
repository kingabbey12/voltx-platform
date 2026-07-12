import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface SupportSessionResponse {
  session: { id: string; status: string; targetOrganizationId: string };
  accessToken: string;
  expiresIn: number;
}

interface SupportSessionListItem {
  id: string;
  status: string;
}

interface SupportNoteResponse {
  id: string;
  note: string;
  authorId: string;
}

interface HealthScoreResponse {
  organizationId: string;
  score: number;
  signals: { name: string; healthy: boolean }[];
}

interface MaintenanceModeResponse {
  enabled: boolean;
}

async function promoteToPlatformAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.system.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
}

describe('Customer Success — impersonation (e2e)', () => {
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

  it('rejects every Customer Success endpoint for a normal (non-platform-admin) org owner', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-non-admin-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    await request(app.getHttpServer())
      .post('/api/v1/platform/support-sessions')
      .set(auth)
      .send({ targetOrganizationId: owner.organization.id, reason: 'Trying to impersonate myself' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/support-sessions')
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${owner.organization.id}/health-score`)
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${owner.organization.id}/support-notes`)
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/maintenance-mode')
      .set(auth)
      .expect(403);
  });

  it('rejects starting a support session with too short a reason', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-short-reason-admin-${Date.now()}@example.com`,
    });
    const target = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-short-reason-target-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);

    await request(app.getHttpServer())
      .post('/api/v1/platform/support-sessions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ targetOrganizationId: target.organization.id, reason: 'too short' })
      .expect(400);
  });

  it(
    'runs a full impersonation lifecycle: start, act as the target org with full audit ' +
      'attribution, and instantly revoke on early end',
    async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `cs-lifecycle-admin-${Date.now()}@example.com`,
      });
      const target = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `cs-lifecycle-target-${Date.now()}@example.com`,
      });
      await promoteToPlatformAdmin(prisma, admin.user.id);
      const adminAuth = { Authorization: `Bearer ${admin.accessToken}` };

      const startResponse = await request(app.getHttpServer())
        .post('/api/v1/platform/support-sessions')
        .set(adminAuth)
        .send({
          targetOrganizationId: target.organization.id,
          reason: 'Investigating a customer-reported billing discrepancy',
        })
        .expect(201);
      const started = (startResponse.body as ApiSuccessResponse<SupportSessionResponse>).data;
      expect(started.session.status).toBe('ACTIVE');
      expect(started.session.targetOrganizationId).toBe(target.organization.id);

      const impersonationAuth = { Authorization: `Bearer ${started.accessToken}` };

      // Starting a second session for the same admin/org pair while one is active must conflict.
      await request(app.getHttpServer())
        .post('/api/v1/platform/support-sessions')
        .set(adminAuth)
        .send({ targetOrganizationId: target.organization.id, reason: 'Duplicate attempt at this' })
        .expect(409);

      // Act inside the target org using the impersonation token — this
      // proves the JIT admin-role membership grants real functional access.
      const createDeptResponse = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${target.organization.id}/structure/departments`)
        .set(impersonationAuth)
        .send({ name: 'Support-created Department' })
        .expect(201);
      expect(createDeptResponse.body).toBeTruthy();

      // Every action during the session must be attributed to BOTH the
      // platform admin (as the real actor) and the SupportSession (as the
      // reason it was allowed), never to a fabricated identity.
      const auditRows = await prisma.system.auditLog.findMany({
        where: { organizationId: target.organization.id, supportSessionId: started.session.id },
      });
      expect(auditRows.length).toBeGreaterThan(0);
      for (const row of auditRows) {
        expect(row.userId).toBe(admin.user.id);
        expect(row.supportSessionId).toBe(started.session.id);
      }

      // Ending the session early must instantly revoke the impersonation
      // token — no separate blocklist, JwtAccessStrategy checks live status.
      await request(app.getHttpServer())
        .delete(`/api/v1/platform/support-sessions/${started.session.id}`)
        .set(adminAuth)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${target.organization.id}/structure/departments`)
        .set(impersonationAuth)
        .send({ name: 'Should be rejected now' })
        .expect(401);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/platform/support-sessions')
        .set(adminAuth)
        .expect(200);
      const sessions = (listResponse.body as ApiSuccessResponse<SupportSessionListItem[]>).data;
      const endedSession = sessions.find((session) => session.id === started.session.id);
      expect(endedSession?.status).toBe('ENDED');

      // Ending an already-ended session must be rejected, not silently succeed.
      await request(app.getHttpServer())
        .delete(`/api/v1/platform/support-sessions/${started.session.id}`)
        .set(adminAuth)
        .expect(409);
    },
  );

  it("never deletes a platform admin's own pre-existing membership when a support session ends", async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-preexisting-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);

    // The admin is already a real member of their own organization — a
    // support session targeting their own org must reuse that membership,
    // not create (or later delete) a synthetic one.
    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/platform/support-sessions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ targetOrganizationId: admin.organization.id, reason: 'Testing session on own org' })
      .expect(201);
    const started = (startResponse.body as ApiSuccessResponse<SupportSessionResponse>).data;

    await request(app.getHttpServer())
      .delete(`/api/v1/platform/support-sessions/${started.session.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const stillMember = await prisma.system.membership.findFirst({
      where: { userId: admin.user.id, organizationId: admin.organization.id },
    });
    expect(stillMember).not.toBeNull();
    expect(stillMember?.status).toBe('ACTIVE');
  });

  it('manages support notes for an organization', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-notes-admin-${Date.now()}@example.com`,
    });
    const target = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-notes-target-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);
    const auth = { Authorization: `Bearer ${admin.accessToken}` };

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/platform/organizations/${target.organization.id}/support-notes`)
      .set(auth)
      .send({ note: 'Customer escalated to VP; handle with priority.' })
      .expect(201);
    const note = (createResponse.body as ApiSuccessResponse<SupportNoteResponse>).data;
    expect(note.authorId).toBe(admin.user.id);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${target.organization.id}/support-notes`)
      .set(auth)
      .expect(200);
    expect((listResponse.body as ApiSuccessResponse<SupportNoteResponse[]>).data).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/platform/organizations/${target.organization.id}/support-notes/${note.id}`)
      .set(auth)
      .expect(200);
  });

  it("computes an organization's health score and diagnostics", async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-health-admin-${Date.now()}@example.com`,
    });
    const target = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-health-target-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);
    const auth = { Authorization: `Bearer ${admin.accessToken}` };

    const scoreResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${target.organization.id}/health-score`)
      .set(auth)
      .expect(200);
    const score = (scoreResponse.body as ApiSuccessResponse<HealthScoreResponse>).data;
    expect(score.organizationId).toBe(target.organization.id);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);

    await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${target.organization.id}/diagnostics`)
      .set(auth)
      .expect(200);
  });

  it('toggles platform maintenance mode', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `cs-maintenance-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, admin.user.id);
    const auth = { Authorization: `Bearer ${admin.accessToken}` };

    const initial = await request(app.getHttpServer())
      .get('/api/v1/platform/maintenance-mode')
      .set(auth)
      .expect(200);
    expect((initial.body as ApiSuccessResponse<MaintenanceModeResponse>).data.enabled).toBe(false);

    const enabled = await request(app.getHttpServer())
      .put('/api/v1/platform/maintenance-mode')
      .set(auth)
      .send({ enabled: true })
      .expect(200);
    expect((enabled.body as ApiSuccessResponse<MaintenanceModeResponse>).data.enabled).toBe(true);

    const disabled = await request(app.getHttpServer())
      .put('/api/v1/platform/maintenance-mode')
      .set(auth)
      .send({ enabled: false })
      .expect(200);
    expect((disabled.body as ApiSuccessResponse<MaintenanceModeResponse>).data.enabled).toBe(false);
  });
});
