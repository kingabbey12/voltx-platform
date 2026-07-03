import { Organization, Prisma } from '@prisma/client';
import { OrganizationEntity } from './organization.entity';

export function toOrganizationEntity(record: Organization): OrganizationEntity {
  const entity = new OrganizationEntity();
  entity.id = record.id;
  entity.name = record.name;
  entity.slug = record.slug;
  entity.logoUrl = record.logoUrl;
  entity.industry = record.industry;
  entity.country = record.country;
  entity.timezone = record.timezone;
  entity.status = record.status;
  entity.settings = record.settings as Record<string, unknown>;
  entity.createdAt = record.createdAt;
  entity.updatedAt = record.updatedAt;
  entity.deletedAt = record.deletedAt;
  return entity;
}

export function toJsonValue(
  settings: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (settings === undefined) {
    return undefined;
  }
  return settings as Prisma.InputJsonValue;
}
