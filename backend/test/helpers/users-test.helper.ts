import { INestApplication } from '@nestjs/common';
import { MembershipStatus, OrganizationStatus, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/database/prisma.service';
import { hashPassword } from '../../src/modules/auth/utils/password.util';
import { VerificationTokenService } from '../../src/modules/auth/verification-token.service';
import { UsersRepository } from '../../src/modules/users/users.repository';
import { seedRbac } from '../../prisma/seed';

export const DEFAULT_TEST_PASSWORD = 'SecurePassword123!';

export async function resetAuthTestData(prisma: PrismaService): Promise<void> {
  const systemClient = prisma.system as unknown as {
    message: { deleteMany(): Promise<unknown> };
    conversation: { deleteMany(): Promise<unknown> };
    toolExecution: { deleteMany(): Promise<unknown> };
    memoryAccess: { deleteMany(): Promise<unknown> };
    memory: { deleteMany(): Promise<unknown> };
  };

  await systemClient.message.deleteMany();
  await systemClient.toolExecution.deleteMany();
  await systemClient.memoryAccess.deleteMany();
  await systemClient.memory.deleteMany();
  await systemClient.conversation.deleteMany();
  await prisma.system.auditLog.deleteMany();
  await prisma.system.verificationToken.deleteMany();
  await prisma.system.refreshToken.deleteMany();
  await prisma.system.membership.deleteMany();
  await prisma.system.rolePermission.deleteMany();
  await prisma.system.user.deleteMany();
  await prisma.system.organization.deleteMany();
  await prisma.system.role.deleteMany();
  await prisma.system.permission.deleteMany();
}

export async function resetAndSeedAuthTestData(prisma: PrismaService): Promise<void> {
  await resetAuthTestData(prisma);
  await seedRbac(prisma.system);
}

export const createUserPayload = {
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  avatarUrl: 'https://cdn.example.com/avatars/jane.png',
  phoneNumber: '+14155552671',
  jobTitle: 'Engineering Manager',
  status: UserStatus.ACTIVE,
};

export async function seedUser(
  usersRepository: UsersRepository,
  overrides: Partial<typeof createUserPayload> = {},
) {
  return usersRepository.create({
    ...createUserPayload,
    ...overrides,
  });
}

export async function setUserPassword(
  prisma: PrismaService,
  userId: string,
  password = DEFAULT_TEST_PASSWORD,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  await prisma.system.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function seedAuthContext(
  prisma: PrismaService,
  usersRepository: UsersRepository,
  roleKey = 'admin',
  overrides: Partial<typeof createUserPayload> = {},
  password = DEFAULT_TEST_PASSWORD,
  options: { organizationId?: string } = {},
) {
  const organization = options.organizationId
    ? await prisma.system.organization.findUniqueOrThrow({
        where: { id: options.organizationId },
      })
    : await prisma.system.organization.create({
        data: {
          name: 'Voltx Labs',
          slug: `voltx-labs-${crypto.randomUUID()}`,
          status: OrganizationStatus.ACTIVE,
        },
      });

  const role = await prisma.system.role.findUniqueOrThrow({ where: { key: roleKey } });

  const user = await seedUser(usersRepository, overrides);
  await setUserPassword(prisma, user.id, password);

  const membership = await prisma.system.membership.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      roleId: role.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  return { user, organization, role, membership, password };
}

export async function loginAs(
  app: INestApplication<App>,
  email: string,
  password: string,
  organizationId?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, organizationId })
    .expect(200);

  const body = response.body as {
    data: { accessToken: string; refreshToken: string };
  };

  return body.data;
}

export async function authenticateContext(
  app: INestApplication<App>,
  prisma: PrismaService,
  usersRepository: UsersRepository,
  roleKey = 'admin',
  overrides: Partial<typeof createUserPayload> = {},
) {
  const context = await seedAuthContext(prisma, usersRepository, roleKey, overrides);
  const tokens = await loginAs(app, context.user.email, context.password, context.organization.id);

  return { ...context, ...tokens };
}

export function bearerAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function issueEmailVerificationToken(
  app: INestApplication<App>,
  userId: string,
): Promise<string> {
  const verificationTokenService = app.get(VerificationTokenService);
  const { token } = await verificationTokenService.issueEmailVerificationToken(userId);
  return token;
}

export async function issuePasswordResetToken(
  app: INestApplication<App>,
  userId: string,
): Promise<string> {
  const verificationTokenService = app.get(VerificationTokenService);
  const { token } = await verificationTokenService.issuePasswordResetToken(userId);
  return token;
}

/** @deprecated Use bearerAuthHeaders after JWT login */
export function authHeaders(_userId: string, _organizationId?: string): Record<string, string> {
  throw new Error('authHeaders is deprecated. Use authenticateContext and bearerAuthHeaders.');
}

/** @deprecated Use resetAuthTestData */
export const resetUsersTables = resetAuthTestData;
