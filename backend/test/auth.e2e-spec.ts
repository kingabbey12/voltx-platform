import { VerificationTokenType } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import {
  AuthMeResponseDto,
  LoginResponseDto,
  MessageResponseDto,
} from '../src/modules/auth/dto/auth-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

describe('AuthController (e2e)', () => {
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

  it('POST /api/v1/auth/login returns access and refresh tokens', async () => {
    const { user, organization, password } = await seedAuthContext(
      prisma,
      usersRepository,
      'admin',
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password,
        organizationId: organization.id,
      })
      .expect(200);

    const body = response.body as ApiSuccessResponse<LoginResponseDto>;
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
    expect(body.data.tokenType).toBe('Bearer');
    expect(body.data.expiresIn).toBe(900);
    expect(body.data.user.id).toBe(user.id);
  });

  it('POST /api/v1/auth/login returns 401 for invalid credentials', async () => {
    const { user, organization } = await seedAuthContext(prisma, usersRepository, 'admin');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'WrongPassword123!',
        organizationId: organization.id,
      })
      .expect(401);
  });

  it('POST /api/v1/auth/register creates user, organization, and tokens', async () => {
    const email = 'register.user@example.com';

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Register',
        lastName: 'User',
        organizationName: 'Register Org',
      })
      .expect(201);

    const body = response.body as ApiSuccessResponse<LoginResponseDto>;
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
    expect(body.data.user.email).toBe(email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Register',
        lastName: 'User',
      })
      .expect(409);
  });

  it('POST /api/v1/auth/refresh rotates refresh tokens', async () => {
    const { accessToken: initialAccessToken, refreshToken: initialRefreshToken } =
      await authenticateContext(app, prisma, usersRepository, 'admin');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(200);

    const body = response.body as ApiSuccessResponse<{
      accessToken: string;
      refreshToken: string;
    }>;

    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).not.toBe(initialRefreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(bearerAuthHeaders(body.data.accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(bearerAuthHeaders(initialAccessToken))
      .expect(200);
  });

  it('POST /api/v1/auth/logout revokes refresh token', async () => {
    const { accessToken, refreshToken } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(bearerAuthHeaders(accessToken))
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('GET /api/v1/auth/me returns profile and authorization context', async () => {
    const { user, organization, accessToken } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<AuthMeResponseDto>;
    expect(body.data.id).toBe(user.id);
    expect(body.data.email).toBe(user.email);
    expect(body.data.organizationId).toBe(organization.id);
    expect(body.data.roles).toContain('admin');
    expect(body.data.permissions).toContain('user.read');
  });

  it('GET /api/v1/auth/me returns 401 without access token', async () => {
    await seedAuthContext(prisma, usersRepository, 'admin');

    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('POST /api/v1/auth/verify-email marks email as verified and revokes token', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'admin');
    const token = await issueEmailVerificationToken(app, user.id);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(200);

    const body = response.body as ApiSuccessResponse<{ message: string; emailVerifiedAt: string }>;
    expect(body.data.message).toBe('Email verified successfully');
    expect(body.data.emailVerifiedAt).toEqual(expect.any(String));

    const updatedUser = await prisma.system.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.emailVerifiedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(401);
  });

  it('POST /api/v1/auth/request-password-reset accepts requests without revealing account existence', async () => {
    const { user } = await seedAuthContext(prisma, usersRepository, 'admin');

    const existingUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/request-password-reset')
      .send({ email: user.email })
      .expect(200);

    const missingUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/request-password-reset')
      .send({ email: 'missing.user@example.com' })
      .expect(200);

    const existingUserBody = existingUserResponse.body as ApiSuccessResponse<MessageResponseDto>;
    const missingUserBody = missingUserResponse.body as ApiSuccessResponse<MessageResponseDto>;

    expect(existingUserBody.data.message).toBe(
      'If the account exists, a password reset email has been sent.',
    );
    expect(missingUserBody.data.message).toBe(
      'If the account exists, a password reset email has been sent.',
    );

    const tokenCount = await prisma.system.verificationToken.count({
      where: {
        userId: user.id,
        type: VerificationTokenType.PASSWORD_RESET,
        usedAt: null,
      },
    });
    expect(tokenCount).toBe(1);
  });

  it('POST /api/v1/auth/reset-password updates password and revokes refresh tokens', async () => {
    const { user, organization, password, refreshToken } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );
    const resetToken = await issuePasswordResetToken(app, user.id);
    const newPassword = 'UpdatedPassword123!';

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: newPassword })
      .expect(200);

    const resetBody = response.body as ApiSuccessResponse<MessageResponseDto>;
    expect(resetBody.data.message).toBe('Password reset successfully');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password, organizationId: organization.id })
      .expect(401);

    await loginAs(app, user.email, newPassword, organization.id);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('GET /api/v1/auth/my-organizations lists every active membership', async () => {
    const { accessToken, organization } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'owner',
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/my-organizations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<
      Array<{ organizationId: string; roleKey: string }>
    >;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].organizationId).toBe(organization.id);
    expect(body.data[0].roleKey).toBe('owner');
  });

  it('POST /api/v1/auth/switch-organization reissues tokens scoped to a second active membership', async () => {
    const first = await authenticateContext(app, prisma, usersRepository, 'owner');

    const secondOrg = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: `second.org.owner.${Date.now()}@example.com`,
    });

    // Add the first user as a member of the second organization directly
    // (no invitation flow needed for this test — that path is covered in
    // invitation.e2e-spec.ts).
    const memberRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });
    await prisma.system.membership.create({
      data: {
        organizationId: secondOrg.organization.id,
        userId: first.user.id,
        roleId: memberRole.id,
        status: 'ACTIVE',
      },
    });

    const orgs = await request(app.getHttpServer())
      .get('/api/v1/auth/my-organizations')
      .set(bearerAuthHeaders(first.accessToken))
      .expect(200);
    expect((orgs.body as ApiSuccessResponse<Array<{ organizationId: string }>>).data).toHaveLength(
      2,
    );

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/switch-organization')
      .set(bearerAuthHeaders(first.accessToken))
      .send({ organizationId: secondOrg.organization.id })
      .expect(200);
    const switchBody = (switchResponse.body as ApiSuccessResponse<LoginResponseDto>).data;
    expect(switchBody.user.email).toBe(first.user.email);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(bearerAuthHeaders(switchBody.accessToken))
      .expect(200);
    const meBody = (me.body as ApiSuccessResponse<AuthMeResponseDto>).data;
    expect(meBody.organizationId).toBe(secondOrg.organization.id);
    expect(meBody.roles).toContain('member');
  });

  it('POST /api/v1/auth/switch-organization rejects a non-member organization', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'owner');
    const otherOrg = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: `unrelated.org.${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/switch-organization')
      .set(bearerAuthHeaders(accessToken))
      .send({ organizationId: otherOrg.organization.id })
      .expect(403);
  });
});
