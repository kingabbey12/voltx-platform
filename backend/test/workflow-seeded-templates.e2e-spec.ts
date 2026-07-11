import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { WorkflowDefinitionValidatorService } from '../src/modules/workflows/definition/workflow-definition-validator.service';
import { seedWorkflowTemplates, TEMPLATE_SEEDS } from '../prisma/seed-workflow-templates';
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
  organizationId: string | null;
}

interface WorkflowBody {
  id: string;
  name: string;
  status: string;
}

describe('Seeded workflow templates (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    await seedWorkflowTemplates();
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('defines exactly 14 templates, every one already passing structural validation', () => {
    expect(TEMPLATE_SEEDS).toHaveLength(14);
    const validator = new WorkflowDefinitionValidatorService();
    for (const template of TEMPLATE_SEEDS) {
      expect(() => validator.validate(template.definition)).not.toThrow();
    }
  });

  it('lists all 14 seeded templates as system templates visible to any organization', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/templates')
      .query({ limit: 50 })
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<{ items: TemplateBody[] }>).data.items;

    for (const template of TEMPLATE_SEEDS) {
      const found = listed.find((item) => item.key === template.key);
      expect(found).toBeDefined();
      expect(found?.isSystem).toBe(true);
      expect(found?.organizationId).toBeNull();
      expect(found?.category).toBe(template.category);
    }
  });

  it('instantiates a simple, an approval-gated, and a loop-based template into real draft workflows', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    for (const key of ['lead_follow_up', 'contract_approval', 'meeting_reminder']) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workflows/templates/${key}/instantiate`)
        .set(bearerAuthHeaders(accessToken))
        .send({ name: `${key}-${Date.now()}` })
        .expect(201);
      const workflow = (response.body as ApiSuccessResponse<WorkflowBody>).data;
      expect(workflow.status).toBe('DRAFT');

      const versionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflow.id}/versions`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const versions = (
        versionsResponse.body as ApiSuccessResponse<Array<{ definition: { steps: unknown[] } }>>
      ).data;
      const latest = versions[versions.length - 1];
      const expectedStepCount = TEMPLATE_SEEDS.find((t) => t.key === key)?.definition.steps.length;
      expect(latest.definition.steps).toHaveLength(expectedStepCount ?? -1);
    }
  });
});
