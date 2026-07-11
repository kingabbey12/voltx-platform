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

interface VariableBody {
  id: string;
  workflowId: string | null;
  key: string;
  type: string;
  defaultValue: unknown;
}

interface WorkflowBody {
  id: string;
}

const minimalDefinition = {
  steps: [
    { id: 'notify', name: 'Notify', type: 'TOOL', config: { toolName: 'datetime', input: {} } },
  ],
};

describe('Workflow Variables (e2e)', () => {
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

  async function createWorkflow(accessToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: `Variable Workflow ${Date.now()}-${Math.random()}`,
        definition: minimalDefinition,
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<WorkflowBody>).data.id;
  }

  it('creates an org-level variable and lists it', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `default_sender_${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, type: 'STRING', defaultValue: 'Voltx Sales' })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<VariableBody>).data;
    expect(created.workflowId).toBeNull();
    expect(created.defaultValue).toBe('Voltx Sales');

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<VariableBody[]>).data;
    expect(listed.some((item) => item.key === key)).toBe(true);
  });

  it('creates a workflow-scoped variable, and it appears alongside org-level ones for that workflow only', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflowId = await createWorkflow(accessToken);
    const orgKey = `shared_${Date.now()}`;
    const scopedKey = `scoped_${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .send({ key: orgKey, type: 'STRING', defaultValue: 'org value' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/variables`)
      .set(bearerAuthHeaders(accessToken))
      .send({ key: scopedKey, type: 'NUMBER', defaultValue: 42 })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowId}/variables`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<VariableBody[]>).data;
    expect(listed.some((item) => item.key === orgKey)).toBe(true);
    expect(listed.some((item) => item.key === scopedKey)).toBe(true);

    const orgOnlyResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const orgOnly = (orgOnlyResponse.body as ApiSuccessResponse<VariableBody[]>).data;
    expect(orgOnly.some((item) => item.key === scopedKey)).toBe(false);
  });

  it('updates and deletes a variable', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `updatable_${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, type: 'STRING', defaultValue: 'v1' })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<VariableBody>).data;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/workflows/variables/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .send({ defaultValue: 'v2' })
      .expect(200);
    expect((updateResponse.body as ApiSuccessResponse<VariableBody>).data.defaultValue).toBe('v2');

    await request(app.getHttpServer())
      .delete(`/api/v1/workflows/variables/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<VariableBody[]>).data;
    expect(listed.some((item) => item.id === created.id)).toBe(false);
  });

  it('never leaks another organization’s variables', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-variables-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-variables-org-b@example.com',
    });
    const key = `org-a-var-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(orgA.accessToken))
      .send({ key, type: 'STRING', defaultValue: 'org a' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/variables')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<VariableBody[]>).data;
    expect(listed.some((item) => item.key === key)).toBe(false);
  });
});
