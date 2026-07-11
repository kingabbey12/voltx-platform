import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSION_DEFINITIONS = [
  { key: 'organization.create', resource: 'organization', action: 'create', description: 'Create organizations' },
  { key: 'organization.read', resource: 'organization', action: 'read', description: 'Read organizations' },
  { key: 'organization.update', resource: 'organization', action: 'update', description: 'Update organizations' },
  { key: 'organization.delete', resource: 'organization', action: 'delete', description: 'Delete organizations' },
  { key: 'organization.invite', resource: 'organization', action: 'invite', description: 'Invite, revoke, and resend organization invitations' },
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
  { key: 'ai.approval.read', resource: 'ai_agent_approval', action: 'read', description: 'View pending AI tool-call approvals' },
  { key: 'ai.approval.decide', resource: 'ai_agent_approval', action: 'decide', description: 'Approve or reject pending AI tool-call approvals' },
  { key: 'ai.tool.execute', resource: 'ai_tool', action: 'execute', description: 'Directly execute a raw AI tool outside an agent run' },
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
  { key: 'knowledge.source.create', resource: 'knowledge_source', action: 'create', description: 'Create knowledge sources' },
  { key: 'knowledge.source.read', resource: 'knowledge_source', action: 'read', description: 'Read knowledge sources' },
  { key: 'knowledge.source.update', resource: 'knowledge_source', action: 'update', description: 'Update knowledge sources' },
  { key: 'knowledge.source.delete', resource: 'knowledge_source', action: 'delete', description: 'Delete knowledge sources' },
  { key: 'knowledge.document.create', resource: 'knowledge_document', action: 'create', description: 'Ingest knowledge documents' },
  { key: 'knowledge.document.read', resource: 'knowledge_document', action: 'read', description: 'Read knowledge documents' },
  { key: 'knowledge.document.delete', resource: 'knowledge_document', action: 'delete', description: 'Delete knowledge documents' },
  { key: 'knowledge.search', resource: 'knowledge', action: 'search', description: 'Search and preview the knowledge graph' },
  { key: 'knowledge.admin', resource: 'knowledge', action: 'admin', description: 'Reindex knowledge sources and view knowledge statistics/health' },
  { key: 'workflow.create', resource: 'workflow', action: 'create', description: 'Create and update workflows' },
  { key: 'workflow.read', resource: 'workflow', action: 'read', description: 'Read workflows and their run history' },
  { key: 'workflow.publish', resource: 'workflow', action: 'publish', description: 'Publish and archive workflows' },
  { key: 'workflow.delete', resource: 'workflow', action: 'delete', description: 'Delete workflows' },
  { key: 'workflow.run', resource: 'workflow', action: 'run', description: 'Run, pause, resume, cancel, and retry workflow runs' },
  { key: 'workflow.approve', resource: 'workflow', action: 'approve', description: 'Approve or reject workflow approval steps' },
  { key: 'workflow.admin', resource: 'workflow', action: 'admin', description: 'View workflow metrics/health and manage schedules' },
  { key: 'integration.create', resource: 'integration', action: 'create', description: 'Connect new integrations' },
  { key: 'integration.read', resource: 'integration', action: 'read', description: 'View integration connections, events, and logs' },
  { key: 'integration.update', resource: 'integration', action: 'update', description: 'Update integration connection settings' },
  { key: 'integration.delete', resource: 'integration', action: 'delete', description: 'Delete integration connections' },
  { key: 'integration.admin', resource: 'integration', action: 'admin', description: 'Reconnect, refresh, sync, health-check, and register webhooks for integrations' },
  { key: 'communications.connection.create', resource: 'comms_channel_connection', action: 'create', description: 'Connect new communication channels' },
  { key: 'communications.connection.read', resource: 'comms_channel_connection', action: 'read', description: 'View communication channel connections' },
  { key: 'communications.connection.update', resource: 'comms_channel_connection', action: 'update', description: 'Update communication channel connection settings' },
  { key: 'communications.connection.delete', resource: 'comms_channel_connection', action: 'delete', description: 'Disconnect communication channels' },
  { key: 'communications.conversation.read', resource: 'comms_conversation', action: 'read', description: 'View the unified inbox and conversations' },
  { key: 'communications.conversation.update', resource: 'comms_conversation', action: 'update', description: 'Assign, archive, pin, and label conversations' },
  { key: 'communications.message.create', resource: 'comms_message', action: 'create', description: 'Send messages across connected channels' },
  { key: 'communications.note.create', resource: 'comms_note', action: 'create', description: 'Add internal, agent-only notes to a conversation' },
  { key: 'notification.read', resource: 'notification', action: 'read', description: 'View your own notifications' },
  { key: 'notification.update', resource: 'notification', action: 'update', description: 'Mark notifications read and update notification preferences' },
  { key: 'attachment.create', resource: 'attachment', action: 'create', description: 'Upload files and attach them to conversations or CRM records' },
  { key: 'attachment.read', resource: 'attachment', action: 'read', description: 'View and download attachments' },
  { key: 'attachment.delete', resource: 'attachment', action: 'delete', description: 'Delete attachments' },
  { key: 'attachment.admin_override', resource: 'attachment', action: 'admin_override', description: 'Download a quarantined attachment despite a failed virus scan' },
  { key: 'ops.dead_letter.read', resource: 'ops_dead_letter', action: 'read', description: 'View background jobs that exhausted their retry attempts' },
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
      'organization.invite',
      'user.create',
      'user.read',
      'user.update',
      'role.read',
      'ai.agent.create',
      'ai.agent.read',
      'ai.agent.update',
      'ai.agent.run',
      'ai.approval.read',
      'ai.approval.decide',
      'ai.tool.execute',
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
      'knowledge.source.create',
      'knowledge.source.read',
      'knowledge.source.update',
      'knowledge.document.create',
      'knowledge.document.read',
      'knowledge.search',
      'knowledge.admin',
      'workflow.create',
      'workflow.read',
      'workflow.publish',
      'workflow.run',
      'workflow.approve',
      'workflow.admin',
      'integration.create',
      'integration.read',
      'integration.update',
      'integration.admin',
      'communications.connection.create',
      'communications.connection.read',
      'communications.connection.update',
      'communications.conversation.read',
      'communications.conversation.update',
      'communications.message.create',
      'communications.note.create',
      'notification.read',
      'notification.update',
      'attachment.create',
      'attachment.read',
      'attachment.delete',
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
      'ai.approval.read',
      'ai.tool.execute',
      'sales.company.read',
      'sales.contact.read',
      'sales.lead.read',
      'sales.opportunity.read',
      'sales.activity.read',
      'sales.ai.run',
      'knowledge.source.read',
      'knowledge.document.read',
      'knowledge.search',
      'workflow.read',
      'workflow.run',
      'workflow.approve',
      'integration.read',
      'communications.connection.read',
      'communications.conversation.read',
      'communications.conversation.update',
      'communications.message.create',
      'communications.note.create',
      'notification.read',
      'notification.update',
      'attachment.create',
      'attachment.read',
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
      'knowledge.source.read',
      'knowledge.document.read',
      'knowledge.search',
      'workflow.read',
      'integration.read',
      'communications.connection.read',
      'communications.conversation.read',
      'notification.read',
      'notification.update',
      'attachment.read',
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
