import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { PermissionResponseDto } from '../src/modules/permissions/dto/permission-response.dto';
import { RoleListResponseDto } from '../src/modules/roles/dto/role-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authHeaders,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

describe('RBAC (e2e)', () => {
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

  it('allows admin to list permissions', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'admin');

    const response = await request(app.getHttpServer())
      .get('/api/v1/permissions')
      .set(authHeaders(user.id))
      .expect(200);

    const body = response.body as ApiSuccessResponse<PermissionResponseDto[]>;
    expect(body.data.length).toBeGreaterThanOrEqual(16);
    expect(body.data.some((permission) => permission.key === 'user.read')).toBe(true);
  });

  it('denies viewer from listing permissions', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'viewer');

    await request(app.getHttpServer())
      .get('/api/v1/permissions')
      .set(authHeaders(user.id))
      .expect(403);
  });

  it('allows manager to list roles', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'manager');

    const response = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set(authHeaders(user.id))
      .expect(200);

    const body = response.body as ApiSuccessResponse<RoleListResponseDto>;
    expect(body.data.items.some((role) => role.key === 'owner')).toBe(true);
  });

  it('denies viewer from listing roles', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'viewer');

    await request(app.getHttpServer()).get('/api/v1/roles').set(authHeaders(user.id)).expect(403);
  });

  it('denies viewer from updating organizations', async () => {
    const { user, organization } = await seedAuthContext(prisma, usersRepository, 'viewer');

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organization.id}`)
      .set(authHeaders(user.id))
      .send({ name: 'Updated Name' })
      .expect(403);
  });
});
