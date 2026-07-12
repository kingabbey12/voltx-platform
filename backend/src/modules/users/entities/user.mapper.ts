import { User } from '@prisma/client';
import { UserEntity } from './user.entity';

export function toUserEntity(record: User): UserEntity {
  const entity = new UserEntity();
  entity.id = record.id;
  entity.email = record.email;
  entity.firstName = record.firstName;
  entity.lastName = record.lastName;
  entity.avatarUrl = record.avatarUrl;
  entity.phoneNumber = record.phoneNumber;
  entity.jobTitle = record.jobTitle;
  entity.status = record.status;
  entity.isPlatformAdmin = record.isPlatformAdmin;
  entity.mfaEnabled = record.mfaEnabled;
  entity.lastLoginAt = record.lastLoginAt;
  entity.emailVerifiedAt = record.emailVerifiedAt;
  entity.createdAt = record.createdAt;
  entity.updatedAt = record.updatedAt;
  entity.deletedAt = record.deletedAt;
  return entity;
}
