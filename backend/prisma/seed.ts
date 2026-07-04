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
  { key: 'ai.agent.create', resource: 'ai_agent', action: 'create', description: 'Create AI agents' },
  { key: 'ai.agent.read', resource: 'ai_agent', action: 'read', description: 'Read AI agents' },
  { key: 'ai.agent.update', resource: 'ai_agent', action: 'update', description: 'Update AI agents' },
  { key: 'ai.agent.delete', resource: 'ai_agent', action: 'delete', description: 'Delete AI agents' },
  { key: 'ai.agent.run', resource: 'ai_agent', action: 'run', description: 'Run AI agents' },
  { key: 'sales.company.create', resource: 'sales_company', action: 'create', description: 'Create sales companies' },
  { key: 'sales.company.read', resource: 'sales_company', action: 'read', description: 'Read sales companies' },
  { key: 'sales.company.update', resource: 'sales_company', action: 'update', description: 'Update sales companies' },
  { key: 'sales.company.delete', resource: 'sales_company', action: 'delete', description: 'Delete sales companies' },
  { key: 'sales.contact.create', resource: 'sales_contact', action: 'create', description: 'Create sales contacts' },
  { key: 'sales.contact.read', resource: 'sales_contact', action: 'read', description: 'Read sales contacts' },
  { key: 'sales.contact.update', resource: 'sales_contact', action: 'update', description: 'Update sales contacts' },
  { key: 'sales.contact.delete', resource: 'sales_contact', action: 'delete', description: 'Delete sales contacts' },
  { key: 'sales.lead.create', resource: 'sales_lead', action: 'create', description: 'Create sales leads' },
  { key: 'sales.lead.read', resource: 'sales_lead', action: 'read', description: 'Read sales leads' },
  { key: 'sales.lead.update', resource: 'sales_lead', action: 'update', description: 'Update sales leads' },
  { key: 'sales.lead.delete', resource: 'sales_lead', action: 'delete', description: 'Delete sales leads' },
  { key: 'sales.opportunity.create', resource: 'sales_opportunity', action: 'create', description: 'Create sales opportunities' },
  { key: 'sales.opportunity.read', resource: 'sales_opportunity', action: 'read', description: 'Read sales opportunities' },
  { key: 'sales.opportunity.update', resource: 'sales_opportunity', action: 'update', description: 'Update sales opportunities' },
  { key: 'sales.opportunity.delete', resource: 'sales_opportunity', action: 'delete', description: 'Delete sales opportunities' },
  { key: 'sales.activity.create', resource: 'sales_activity', action: 'create', description: 'Create sales activities' },
  { key: 'sales.activity.read', resource: 'sales_activity', action: 'read', description: 'Read sales activities' },
  { key: 'sales.activity.update', resource: 'sales_activity', action: 'update', description: 'Update sales activities' },
  { key: 'sales.activity.delete', resource: 'sales_activity', action: 'delete', description: 'Delete sales activities' },
  { key: 'sales.ai.run', resource: 'sales_ai', action: 'run', description: 'Run sales AI actions' },
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
      'ai.agent.create',
      'ai.agent.read',
      'ai.agent.update',
      'ai.agent.run',
      'sales.company.create',
      'sales.company.read',
      'sales.company.update',
      'sales.contact.create',
      'sales.contact.read',
      'sales.contact.update',
      'sales.lead.create',
      'sales.lead.read',
      'sales.lead.update',
      'sales.opportunity.create',
      'sales.opportunity.read',
      'sales.opportunity.update',
      'sales.activity.create',
      'sales.activity.read',
      'sales.activity.update',
      'sales.ai.run',
    ],
  },
  {
    key: 'member',
    name: 'Member',
    description: 'Standard member access',
    permissions: [
      'organization.read',
      'user.read',
      'role.read',
      'ai.agent.read',
      'ai.agent.run',
      'sales.company.read',
      'sales.contact.read',
      'sales.lead.read',
      'sales.opportunity.read',
      'sales.activity.read',
      'sales.ai.run',
    ],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'organization.read',
      'user.read',
      'ai.agent.read',
      'sales.company.read',
      'sales.contact.read',
      'sales.lead.read',
      'sales.opportunity.read',
      'sales.activity.read',
    ],
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
