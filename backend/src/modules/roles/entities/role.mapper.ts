import { Permission, Role } from '@prisma/client';
import { RoleEntity } from './role.entity';

type RoleWithPermissions = Role & {
  rolePermissions: Array<{ permission: Permission }>;
};

export function toRoleEntity(record: RoleWithPermissions): RoleEntity {
  const entity = new RoleEntity();
  entity.id = record.id;
  entity.key = record.key;
  entity.name = record.name;
  entity.description = record.description;
  entity.isSystem = record.isSystem;
  entity.organizationId = record.organizationId;
  entity.permissionKeys = record.rolePermissions
    .map((item) => item.permission.key)
    .sort((a, b) => a.localeCompare(b));
  entity.createdAt = record.createdAt;
  entity.updatedAt = record.updatedAt;
  return entity;
}

export function toRoleEntityWithoutPermissions(record: Role): RoleEntity {
  const entity = new RoleEntity();
  entity.id = record.id;
  entity.key = record.key;
  entity.name = record.name;
  entity.description = record.description;
  entity.isSystem = record.isSystem;
  entity.organizationId = record.organizationId;
  entity.permissionKeys = [];
  entity.createdAt = record.createdAt;
  entity.updatedAt = record.updatedAt;
  return entity;
}
