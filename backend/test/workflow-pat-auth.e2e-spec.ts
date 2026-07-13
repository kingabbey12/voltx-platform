import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface CreatePersonalAccessTokenResponse {
  id: string;
  token: string;
}

interface WorkflowResponse {
  id: string;
  name: string;
  status: string;
}

interface WorkflowRunResponse {
  id: string;
  status: string;
}

/**
 * Proves the real gap the Voltx CLI (v2.3 Phase 6) exposed is actually
 * closed: JwtOrPersonalAccessTokenGuard lets a Personal Access Token call
 * the same business endpoints a JWT-authenticated request would, with no
 * JWT involved at all — not just PersonalAccessTokenGuard's own isolated
 * whoami diagnostic route.
 */
describe('Workflows via Personal Access Token auth (e2e)', () => {
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

  async function createPat(accessToken: string, scopedPermissions: string[]): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/developer/personal-access-tokens')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'CLI token', scopedPermissions })
      .expect(201);
    return (response.body as ApiSuccessResponse<CreatePersonalAccessTokenResponse>).data.token;
  }

  it('creates, runs, and reads logs for a workflow using only a Personal Access Token', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `workflow-pat-${Date.now()}@example.com`,
    });
    const pat = await createPat(owner.accessToken, [
      'workflow.create',
      'workflow.read',
      'workflow.run',
      'workflow.publish',
    ]);
    const patAuth = { 'X-Personal-Access-Token': pat, 'X-Organization-Id': owner.organization.id };

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set(patAuth)
      .send({
        name: 'CLI Smoke Test Workflow',
        definition: {
          steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 10 } }],
        },
      })
      .expect(201);
    const workflow = (createResponse.body as ApiSuccessResponse<WorkflowResponse>).data;
    expect(workflow.name).toBe('CLI Smoke Test Workflow');

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflow.id}/publish`)
      .set(patAuth)
      .expect(201);

    const runResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflow.id}/run`)
      .set(patAuth)
      .expect(201);
    const run = (runResponse.body as ApiSuccessResponse<WorkflowRunResponse>).data;
    expect(run.id).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/logs`)
      .set(patAuth)
      .expect(200);
  });

  it('rejects a Personal Access Token missing the required permission', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `workflow-pat-forbidden-${Date.now()}@example.com`,
    });
    const pat = await createPat(owner.accessToken, ['workflow.read']);

    await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set({ 'X-Personal-Access-Token': pat, 'X-Organization-Id': owner.organization.id })
      .send({
        name: 'Should be forbidden',
        definition: {
          steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 10 } }],
        },
      })
      .expect(403);
  });

  it('never lets a Personal Access Token read another organization’s workflow', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `workflow-pat-isolation-a-${Date.now()}@example.com`,
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `workflow-pat-isolation-b-${Date.now()}@example.com`,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${orgA.accessToken}`)
      .send({
        name: 'Org A workflow',
        definition: {
          steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 10 } }],
        },
      })
      .expect(201);
    const workflow = (createResponse.body as ApiSuccessResponse<WorkflowResponse>).data;

    const patB = await createPat(orgB.accessToken, ['workflow.read']);

    await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflow.id}`)
      .set({ 'X-Personal-Access-Token': patB, 'X-Organization-Id': orgB.organization.id })
      .expect(404);
  });
});
