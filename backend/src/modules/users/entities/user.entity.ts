import { UserStatus } from '@prisma/client';

export class UserEntity {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  avatarUrl!: string | null;
  phoneNumber!: string | null;
  jobTitle!: string | null;
  status!: UserStatus;
  lastLoginAt!: Date | null;
  emailVerifiedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
}
