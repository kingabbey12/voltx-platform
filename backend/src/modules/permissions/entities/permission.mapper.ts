import { Permission } from '@prisma/client';
import { PermissionEntity } from './permission.entity';

export function toPermissionEntity(record: Permission): PermissionEntity {
  const entity = new PermissionEntity();
  entity.id = record.id;
  entity.key = record.key;
  entity.resource = record.resource;
  entity.action = record.action;
  entity.description = record.description;
  entity.createdAt = record.createdAt;
  entity.updatedAt = record.updatedAt;
  return entity;
}
