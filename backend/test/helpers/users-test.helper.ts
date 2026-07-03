import { MembershipStatus, OrganizationStatus, UserStatus } from '@prisma/client';
import {
  DEV_ORGANIZATION_ID_HEADER,
  DEV_USER_ID_HEADER,
} from '../../src/modules/auth/constants/development-auth.constants';
import { PrismaService } from '../../src/database/prisma.service';
import { UsersRepository } from '../../src/modules/users/users.repository';

export async function resetAuthTestData(prisma: PrismaService): Promise<void> {
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany();
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

export async function seedAuthContext(
  prisma: PrismaService,
  usersRepository: UsersRepository,
  overrides: Partial<typeof createUserPayload> = {},
) {
  const organization = await prisma.organization.create({
    data: {
      name: 'Voltx Labs',
      slug: `voltx-labs-${crypto.randomUUID()}`,
      status: OrganizationStatus.ACTIVE,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'admin' },
    create: { name: 'admin', description: 'Administrator' },
    update: {},
  });

  const user = await seedUser(usersRepository, overrides);

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      roleId: role.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  return { user, organization, role, membership };
}

export function authHeaders(userId: string, organizationId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    [DEV_USER_ID_HEADER]: userId,
  };

  if (organizationId) {
    headers[DEV_ORGANIZATION_ID_HEADER] = organizationId;
  }

  return headers;
}

/** @deprecated Use resetAuthTestData */
export const resetUsersTables = resetAuthTestData;
