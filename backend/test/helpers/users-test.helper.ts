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
    agentRun: { deleteMany(): Promise<unknown> };
    agent: { deleteMany(): Promise<unknown> };
    salesActivity: { deleteMany(): Promise<unknown> };
    salesOpportunity: { deleteMany(): Promise<unknown> };
    salesLead: { deleteMany(): Promise<unknown> };
    salesContact: { deleteMany(): Promise<unknown> };
    salesCompany: { deleteMany(): Promise<unknown> };
  };

  await ignoreMissingTable(() => systemClient.salesActivity.deleteMany());
  await ignoreMissingTable(() => systemClient.salesOpportunity.deleteMany());
  await ignoreMissingTable(() => systemClient.salesLead.deleteMany());
  await ignoreMissingTable(() => systemClient.salesContact.deleteMany());
  await ignoreMissingTable(() => systemClient.salesCompany.deleteMany());
  await ignoreMissingTable(() => systemClient.message.deleteMany());
  await ignoreMissingTable(() => systemClient.toolExecution.deleteMany());
  await ignoreMissingTable(() => systemClient.memoryAccess.deleteMany());
  await ignoreMissingTable(() => systemClient.memory.deleteMany());
  await ignoreMissingTable(() => systemClient.agentRun.deleteMany());
  await ignoreMissingTable(() => systemClient.agent.deleteMany());
  await ignoreMissingTable(() => systemClient.conversation.deleteMany());
  await ignoreMissingTable(() => prisma.system.auditLog.deleteMany());
  await ignoreMissingTable(() => prisma.system.verificationToken.deleteMany());
  // v2.2 Security Center — RefreshToken.sessionId FKs into Session, so
  // refresh tokens must go first; Session/TrustedDevice/ApiKey all FK into
  // User/Organization and must be cleared before those are deleted below.
  await ignoreMissingTable(() => prisma.system.refreshToken.deleteMany());
  await ignoreMissingTable(() => prisma.session.deleteMany());
  await ignoreMissingTable(() => prisma.trustedDevice.deleteMany());
  await ignoreMissingTable(() => prisma.apiKey.deleteMany());
  // v2.2 Customer Success — no declared FK relation to User/Organization
  // (same unscoped convention as other v2.2 platform-admin models), so
  // leftover rows can't cause a foreign-key violation here, but clearing
  // them avoids a stale "already have an active support session" false
  // positive bleeding across test runs.
  await ignoreMissingTable(() => prisma.system.supportSession.deleteMany());
  await ignoreMissingTable(() => prisma.system.supportNote.deleteMany());
  await ignoreMissingTable(() => prisma.system.membership.deleteMany());
  // Invitation.invitedByUserId/acceptedByUserId restrict user deletion (only
  // organizationId cascades), so this must run before user.deleteMany().
  await ignoreMissingTable(() => prisma.system.invitation.deleteMany());
  // ConsentRecord.userId has no onDelete: Cascade (unlike Session/TrustedDevice),
  // so it must also be cleared before user.deleteMany() or that call 409s with
  // a foreign key violation on every run after the first that creates one.
  await ignoreMissingTable(() => prisma.system.consentRecord.deleteMany());
  await ignoreMissingTable(() => prisma.system.rolePermission.deleteMany());
  await ignoreMissingTable(() => prisma.system.user.deleteMany());
  await ignoreMissingTable(() => prisma.system.organization.deleteMany());
  await ignoreMissingTable(() => prisma.system.role.deleteMany());
  await ignoreMissingTable(() => prisma.system.permission.deleteMany());
}

async function ignoreMissingTable(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }

    throw error;
  }
}

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('does not exist') || message.includes('does not exist in the current database')
  );
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
