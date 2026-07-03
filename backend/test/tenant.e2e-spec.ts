import { INestApplication } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { OrganizationResponseDto } from '../src/modules/organization/dto/organization-response.dto';
import { UserResponseDto } from '../src/modules/users/dto/user-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { createOrganizationPayload } from './helpers/organization-test.helper';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

describe('Multi-Tenancy (e2e)', () => {
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

  it('returns 403 when accessing another organization by id', async () => {
    const tenantA = await authenticateContext(app, prisma, usersRepository, 'admin');
    const tenantB = await seedAuthContext(prisma, usersRepository, 'admin', {
      email: 'other.admin@example.com',
      firstName: 'Other',
      lastName: 'Admin',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${tenantB.organization.id}`)
      .set(bearerAuthHeaders(tenantA.accessToken))
      .expect(403);
  });

  it('returns 403 when updating another organization', async () => {
    const tenantA = await authenticateContext(app, prisma, usersRepository, 'admin');
    const tenantB = await seedAuthContext(prisma, usersRepository, 'admin', {
      email: 'other.admin@example.com',
      firstName: 'Other',
      lastName: 'Admin',
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${tenantB.organization.id}`)
      .set(bearerAuthHeaders(tenantA.accessToken))
      .send({ name: 'Hijacked Org' })
      .expect(403);
  });

  it('returns 403 when reading a user from another organization', async () => {
    const tenantA = await authenticateContext(app, prisma, usersRepository, 'admin');
    const tenantB = await seedAuthContext(prisma, usersRepository, 'admin', {
      email: 'other.user@example.com',
      firstName: 'Other',
      lastName: 'User',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/users/${tenantB.user.id}`)
      .set(bearerAuthHeaders(tenantA.accessToken))
      .expect(403);
  });

  it('lists only users from the current tenant organization', async () => {
    const tenantA = await authenticateContext(app, prisma, usersRepository, 'admin');
    await seedAuthContext(prisma, usersRepository, 'admin', {
      email: 'isolated.user@example.com',
      firstName: 'Isolated',
      lastName: 'User',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set(bearerAuthHeaders(tenantA.accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<{
      items: UserResponseDto[];
      total: number;
    }>;

    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.id).toBe(tenantA.user.id);
  });

  it('lists only the current tenant organization', async () => {
    const tenantA = await authenticateContext(app, prisma, usersRepository, 'admin');
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send(createOrganizationPayload);

    const response = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set(bearerAuthHeaders(tenantA.accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<{
      items: OrganizationResponseDto[];
      total: number;
    }>;

    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.id).toBe(tenantA.organization.id);
    expect(body.data.items[0]?.status).toBe(OrganizationStatus.ACTIVE);
  });
});
