import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

interface BackgroundJobFailureBody {
  id: string;
  organizationId: string | null;
  queueName: string;
  jobName: string;
  failureReason: string;
  attemptsMade: number;
}

describe('Background job dead letters (e2e)', () => {
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

  // REDIS_ENABLED isn't set in this test environment, so DeadLetterListenerService
  // never subscribes to real queue failures here — this directly inserts what the
  // listener would have persisted, to test the read/RBAC/isolation surface in
  // isolation from BullMQ/Redis.
  async function insertDeadLetter(organizationId: string | null): Promise<string> {
    const client = prisma.system as unknown as {
      backgroundJobFailure: {
        create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
      };
    };
    const row = await client.backgroundJobFailure.create({
      data: {
        organizationId,
        queueName: 'attachment-process',
        jobName: 'process',
        jobId: 'job-1',
        payload: { attachmentId: 'attachment-1' },
        failureReason: 'Timed out after 3 attempts',
        attemptsMade: 3,
      },
    });
    return row.id;
  }

  it('lets an admin list its organization’s dead letters', async () => {
    const { accessToken, organization } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
      { email: 'dead-letter-admin@example.com' },
    );

    await insertDeadLetter(organization.id);

    const response = await request(app.getHttpServer())
      .get('/api/v1/ops/dead-letters')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const items = (response.body as ApiSuccessResponse<{ items: BackgroundJobFailureBody[] }>).data
      .items;
    expect(items).toHaveLength(1);
    expect(items[0].queueName).toBe('attachment-process');
    expect(items[0].attemptsMade).toBe(3);
  });

  it('denies a member without ops.dead_letter.read', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: 'dead-letter-viewer@example.com',
    });

    await request(app.getHttpServer())
      .get('/api/v1/ops/dead-letters')
      .set(bearerAuthHeaders(accessToken))
      .expect(403);
  });

  it('never returns another organization’s dead letters', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'dead-letter-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'dead-letter-org-b@example.com',
    });

    await insertDeadLetter(orgA.organization.id);

    const responseAsOrgB = await request(app.getHttpServer())
      .get('/api/v1/ops/dead-letters')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const itemsForOrgB = (
      responseAsOrgB.body as ApiSuccessResponse<{ items: BackgroundJobFailureBody[] }>
    ).data.items;
    expect(itemsForOrgB).toHaveLength(0);

    const responseAsOrgA = await request(app.getHttpServer())
      .get('/api/v1/ops/dead-letters')
      .set(bearerAuthHeaders(orgA.accessToken))
      .expect(200);
    const itemsForOrgA = (
      responseAsOrgA.body as ApiSuccessResponse<{ items: BackgroundJobFailureBody[] }>
    ).data.items;
    expect(itemsForOrgA).toHaveLength(1);
  });
});
