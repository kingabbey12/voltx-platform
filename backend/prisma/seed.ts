import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSION_DEFINITIONS = [
  { key: 'organization.create', resource: 'organization', action: 'create', description: 'Create organizations' },
  { key: 'organization.read', resource: 'organization', action: 'read', description: 'Read organizations' },
  { key: 'organization.update', resource: 'organization', action: 'update', description: 'Update organizations' },
  { key: 'organization.delete', resource: 'organization', action: 'delete', description: 'Delete organizations' },
  { key: 'user.create', resource: 'user', action: 'create', description: 'Create users' },
  { key: 'user.read', resource: 'user', action: 'read', description: 'Read users' },
  { key: 'user.update', resource: 'user', action: 'update', description: 'Update users' },
  { key: 'user.delete', resource: 'user', action: 'delete', description: 'Delete users' },
  { key: 'role.create', resource: 'role', action: 'create', description: 'Create roles' },
  { key: 'role.read', resource: 'role', action: 'read', description: 'Read roles' },
  { key: 'role.update', resource: 'role', action: 'update', description: 'Update roles' },
  { key: 'role.delete', resource: 'role', action: 'delete', description: 'Delete roles' },
  { key: 'permission.create', resource: 'permission', action: 'create', description: 'Create permissions' },
  { key: 'permission.read', resource: 'permission', action: 'read', description: 'Read permissions' },
  { key: 'permission.update', resource: 'permission', action: 'update', description: 'Update permissions' },
  { key: 'permission.delete', resource: 'permission', action: 'delete', description: 'Delete permissions' },
] as const;

const ROLE_DEFINITIONS = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: PERMISSION_DEFINITIONS.map((permission) => permission.key),
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Administrative access excluding permission management mutations',
    permissions: PERMISSION_DEFINITIONS.filter(
      (permission) =>
        !['permission.create', 'permission.update', 'permission.delete'].includes(permission.key),
    ).map((permission) => permission.key),
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Manage users and update organization settings',
    permissions: [
      'organization.read',
      'organization.update',
      'user.create',
      'user.read',
      'user.update',
      'role.read',
    ],
  },
  {
    key: 'member',
    name: 'Member',
    description: 'Standard member access',
    permissions: ['organization.read', 'user.read', 'role.read'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['organization.read', 'user.read'],
  },
] as const;

export async function seedRbac(client: PrismaClient = prisma): Promise<void> {
  for (const permission of PERMISSION_DEFINITIONS) {
    await client.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
    });
  }

  const permissionsByKey = await client.permission.findMany();
  const permissionIdByKey = new Map(permissionsByKey.map((item) => [item.key, item.id]));

  for (const role of ROLE_DEFINITIONS) {
    const persistedRole = await client.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    await client.rolePermission.deleteMany({ where: { roleId: persistedRole.id } });

    const permissionIds = role.permissions
      .map((key) => permissionIdByKey.get(key))
      .filter((id): id is string => id !== undefined);

    if (permissionIds.length > 0) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: persistedRole.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function main(): Promise<void> {
  await seedRbac();
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
