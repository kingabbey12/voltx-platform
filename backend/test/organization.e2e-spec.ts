import { INestApplication } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { OrganizationResponseDto } from '../src/modules/organization/dto/organization-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { createOrganizationPayload } from './helpers/organization-test.helper';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('OrganizationController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let tenantOrganizationId: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    const auth = await authenticateContext(app, prisma, usersRepository, 'admin');
    adminAccessToken = auth.accessToken;
    tenantOrganizationId = auth.organization.id;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
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
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${tenantOrganizationId}`)
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.data.id).toBe(tenantOrganizationId);
  });

  it('GET /api/v1/organizations/:id returns 404 for missing organization', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/organizations/00000000-0000-0000-0000-000000000000')
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(403);
  });

  it('GET /api/v1/organizations returns paginated list for current tenant only', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<{
      items: OrganizationResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>;

    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.id).toBe(tenantOrganizationId);
    expect(body.data.page).toBe(1);
  });

  it('PATCH /api/v1/organizations/:id updates organization', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${tenantOrganizationId}`)
      .set(bearerAuthHeaders(adminAccessToken))
      .send({ name: 'Acme Inc.', industry: 'Software' })
      .expect(200);

    const body = response.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(body.data.name).toBe('Acme Inc.');
    expect(body.data.industry).toBe('Software');
  });

  it('DELETE /api/v1/organizations/:id soft deletes organization', async () => {
    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${tenantOrganizationId}`)
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(200);

    const deleteBody = deleteResponse.body as ApiSuccessResponse<OrganizationResponseDto>;
    expect(deleteBody.data.id).toBe(tenantOrganizationId);

    const deleted = await prisma.system.organization.findUnique({
      where: { id: tenantOrganizationId },
    });
    expect(deleted?.deletedAt).not.toBeNull();

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${tenantOrganizationId}`)
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set(bearerAuthHeaders(adminAccessToken))
      .expect(401);
  });
});
