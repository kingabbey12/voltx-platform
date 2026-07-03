import { INestApplication } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { OrganizationResponseDto } from '../src/modules/organization/dto/organization-response.dto';
import { createTestApp } from './create-test-app';
import {
  createOrganizationPayload,
  resetOrganizationsTable,
} from './helpers/organization-test.helper';

describe('OrganizationController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetOrganizationsTable(prisma);
  });

  afterAll(async () => {
    await resetOrganizationsTable(prisma);
    await app.close();
  });

  it('POST /api/v1/organizations creates an organization with auto-generated slug', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(createOrganizationPayload.name);
    expect(body.data.slug).toBe('acme-corporation');
    expect(body.data.status).toBe(OrganizationStatus.ACTIVE);
    expect(body.meta.version).toBe('v1');
  });

  it('POST /api/v1/organizations appends numeric suffix for duplicate name slugs', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.data.slug).toBe('acme-corporation-2');
  });

  it('POST /api/v1/organizations validates request body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ name: 'A' })
      .expect(400);
  });

  it('GET /api/v1/organizations/:id returns organization', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const created = createResponse.body as ApiSuccessResponse<OrganizationResponseDto>;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${created.data.id}`)
      .expect(200);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.data.id).toBe(created.data.id);
    expect(body.data.slug).toBe('acme-corporation');
  });

  it('GET /api/v1/organizations/:id returns 404 for missing organization', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/organizations/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /api/v1/organizations returns paginated list', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ ...createOrganizationPayload, name: 'Beta Corp' })
      .expect(201);

    const response = await request(app.getHttpServer()).get('/api/v1/organizations').expect(200);

    const body = response.body as ApiSuccessResponse<{
      items: OrganizationResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>;

    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
    expect(body.data.page).toBe(1);
  });

  it('PATCH /api/v1/organizations/:id updates organization', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const created = createResponse.body as ApiSuccessResponse<OrganizationResponseDto>;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${created.data.id}`)
      .send({ name: 'Acme Inc.', industry: 'Software' })
      .expect(200);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.data.name).toBe('Acme Inc.');
    expect(body.data.industry).toBe('Software');
    expect(body.data.slug).toBe('acme-corporation');
  });

  it('DELETE /api/v1/organizations/:id soft deletes organization', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const created = createResponse.body as ApiSuccessResponse<OrganizationResponseDto>;

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${created.data.id}`)
      .expect(200);

    await request(app.getHttpServer()).get(`/api/v1/organizations/${created.data.id}`).expect(404);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .expect(200);

    const listBody = listResponse.body as ApiSuccessResponse<{
      items: OrganizationResponseDto[];
      total: number;
    }>;
    expect(listBody.data.total).toBe(0);
  });
});
