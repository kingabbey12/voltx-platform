import { INestApplication } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UserResponseDto } from '../src/modules/users/dto/user-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authHeaders,
  createUserPayload,
  resetAuthTestData,
  seedAuthContext,
  seedUser,
} from './helpers/users-test.helper';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAuthTestData(prisma);
    await app.close();
  });

  it('GET /api/v1/users/me returns the authenticated user profile', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository);

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(authHeaders(user.id))
      .expect(200);

    const body = response.body as ApiSuccessResponse<UserResponseDto>;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(user.id);
    expect(body.data.email).toBe(createUserPayload.email);
    expect(body.meta.version).toBe('v1');
  });

  it('GET /api/v1/users/me returns 401 without authentication', async () => {
    await seedAuthContext(prisma, usersRepository);

    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET /api/v1/users/me returns 401 when user has no active membership', async () => {
    const user = await seedUser(usersRepository);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(authHeaders(user.id))
      .expect(401);
  });

  it('PATCH /api/v1/users/me updates the authenticated user profile', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set(authHeaders(user.id))
      .send({ firstName: 'Janet', jobTitle: 'Director of Engineering' })
      .expect(200);

    const body = response.body as ApiSuccessResponse<UserResponseDto>;
    expect(body.data.firstName).toBe('Janet');
    expect(body.data.jobTitle).toBe('Director of Engineering');
    expect(body.data.email).toBe(createUserPayload.email);
  });

  it('GET /api/v1/users/:id returns user by id', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository);

    const response = await request(app.getHttpServer()).get(`/api/v1/users/${user.id}`).expect(200);

    const body = response.body as ApiSuccessResponse<UserResponseDto>;
    expect(body.data.id).toBe(user.id);
    expect(body.data.status).toBe(UserStatus.ACTIVE);
  });

  it('GET /api/v1/users/:id returns 404 for missing user', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /api/v1/users returns paginated users', async () => {
    await seedAuthContext(prisma, usersRepository);
    await seedAuthContext(prisma, usersRepository, {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const response = await request(app.getHttpServer()).get('/api/v1/users').expect(200);

    const body = response.body as ApiSuccessResponse<{
      items: UserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>;

    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  it('GET /api/v1/users supports search filtering', async () => {
    await seedAuthContext(prisma, usersRepository);
    await seedAuthContext(prisma, usersRepository, {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ search: 'john' })
      .expect(200);

    const body = response.body as ApiSuccessResponse<{ items: UserResponseDto[]; total: number }>;
    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.firstName).toBe('John');
  });
});
