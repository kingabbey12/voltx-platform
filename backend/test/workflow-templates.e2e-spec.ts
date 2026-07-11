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

interface TemplateBody {
  id: string;
  key: string;
  name: string;
  category: string;
  isSystem: boolean;
}

interface WorkflowBody {
  id: string;
  name: string;
  status: string;
}

const minimalDefinition = {
  steps: [
    { id: 'notify', name: 'Notify', type: 'TOOL', config: { toolName: 'datetime', input: {} } },
  ],
};

describe('Workflow Templates (e2e)', () => {
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

  it('creates a custom template, lists it, and instantiates a real workflow from it', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `custom-template-${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(accessToken))
      .send({
        key,
        name: 'Custom Template',
        category: 'sales',
        definition: minimalDefinition,
      })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<TemplateBody>).data;
    expect(created.key).toBe(key);
    expect(created.isSystem).toBe(false);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<{ items: TemplateBody[] }>).data.items;
    expect(listed.some((item) => item.key === key)).toBe(true);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/templates/${key}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect((getResponse.body as ApiSuccessResponse<TemplateBody>).data.key).toBe(key);

    const instantiateResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/templates/${key}/instantiate`)
      .set(bearerAuthHeaders(accessToken))
      .send({ name: 'My Instance' })
      .expect(201);
    const workflow = (instantiateResponse.body as ApiSuccessResponse<WorkflowBody>).data;
    expect(workflow.name).toBe('My Instance');
    expect(workflow.status).toBe('DRAFT');

    const workflowResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflow.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect((workflowResponse.body as ApiSuccessResponse<WorkflowBody>).data.id).toBe(workflow.id);
  });

  it('rejects creating a template with an invalid definition', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    await request(app.getHttpServer())
      .post('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(accessToken))
      .send({
        key: `bad-template-${Date.now()}`,
        name: 'Bad Template',
        category: 'sales',
        definition: { steps: [] },
      })
      .expect(400);
  });

  it('404s instantiating an unknown template key', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    await request(app.getHttpServer())
      .post('/api/v1/workflows/templates/does-not-exist/instantiate')
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(404);
  });

  it('denies a member without workflow.template.manage from creating a template', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'viewer');

    await request(app.getHttpServer())
      .post('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(accessToken))
      .send({
        key: `viewer-template-${Date.now()}`,
        name: 'Viewer Template',
        category: 'sales',
        definition: minimalDefinition,
      })
      .expect(403);
  });

  it('never leaks another organization’s custom template', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-templates-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-templates-org-b@example.com',
    });
    const key = `org-a-template-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(orgA.accessToken))
      .send({ key, name: 'Org A Template', category: 'sales', definition: minimalDefinition })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/templates')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<{ items: TemplateBody[] }>).data.items;
    expect(listed.some((item) => item.key === key)).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/workflows/templates/${key}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);
  });
});
