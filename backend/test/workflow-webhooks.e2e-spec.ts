import { createHmac } from 'node:crypto';
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

interface WebhookCreatedBody {
  id: string;
  token: string;
  secret: string;
  enabled: boolean;
}

interface WorkflowBody {
  id: string;
}

const minimalDefinition = {
  steps: [
    { id: 'notify', name: 'Notify', type: 'TOOL', config: { toolName: 'datetime', input: {} } },
  ],
};

function signBody(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

describe('Workflow Webhooks (e2e)', () => {
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

  async function createPublishedWorkflow(accessToken: string): Promise<string> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: `Webhook Workflow ${Date.now()}-${Math.random()}`,
        definition: minimalDefinition,
      })
      .expect(201);
    const workflow = (createResponse.body as ApiSuccessResponse<WorkflowBody>).data;
    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflow.id}/publish`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    return workflow.id;
  }

  it('registers a webhook, returning the secret only once', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflowId = await createPublishedWorkflow(accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/webhooks`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<WebhookCreatedBody>).data;
    expect(created.token).toBeTruthy();
    expect(created.secret).toBeTruthy();
    expect(created.enabled).toBe(true);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowId}/webhooks`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<Array<Record<string, unknown>>>).data;
    expect(listed.some((item) => item.id === created.id)).toBe(true);
    expect(listed.every((item) => !('secret' in item))).toBe(true);
  });

  it('starts a real workflow run when the inbound webhook is correctly signed', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflowId = await createPublishedWorkflow(accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/webhooks`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    const { token, secret } = (createResponse.body as ApiSuccessResponse<WebhookCreatedBody>).data;

    const payload = JSON.stringify({ hello: 'world' });
    const signature = signBody(secret, payload);

    const receiveResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/webhooks/${token}`)
      .set('Content-Type', 'application/json')
      .set('x-workflow-signature', signature)
      .send(payload)
      .expect(200);
    const received = (
      receiveResponse.body as ApiSuccessResponse<{ received: boolean; runId: string }>
    ).data;
    expect(received.received).toBe(true);
    expect(received.runId).toBeTruthy();

    const runResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${received.runId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const run = (runResponse.body as ApiSuccessResponse<{ triggerType: string }>).data;
    expect(run.triggerType).toBe('API');
  });

  it('rejects an inbound webhook with an invalid signature', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflowId = await createPublishedWorkflow(accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/webhooks`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    const { token } = (createResponse.body as ApiSuccessResponse<WebhookCreatedBody>).data;

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/webhooks/${token}`)
      .set('Content-Type', 'application/json')
      .set('x-workflow-signature', 'sha256=deadbeef')
      .send(JSON.stringify({ hello: 'world' }))
      .expect(404);
  });

  it('rejects an inbound webhook once disabled', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflowId = await createPublishedWorkflow(accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/webhooks`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    const { id, token, secret } = (createResponse.body as ApiSuccessResponse<WebhookCreatedBody>)
      .data;

    await request(app.getHttpServer())
      .patch(`/api/v1/workflows/webhooks/${id}`)
      .set(bearerAuthHeaders(accessToken))
      .send({ enabled: false })
      .expect(200);

    const payload = JSON.stringify({ hello: 'world' });
    await request(app.getHttpServer())
      .post(`/api/v1/workflows/webhooks/${token}`)
      .set('Content-Type', 'application/json')
      .set('x-workflow-signature', signBody(secret, payload))
      .send(payload)
      .expect(404);
  });

  it('404s an unknown token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workflows/webhooks/00000000-0000-0000-0000-000000000000')
      .set('Content-Type', 'application/json')
      .set('x-workflow-signature', 'sha256=whatever')
      .send(JSON.stringify({}))
      .expect(404);
  });
});
