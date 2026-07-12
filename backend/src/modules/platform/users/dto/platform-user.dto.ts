import { UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserEntity } from '../../../users/entities/user.entity';

export class ListPlatformUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class PlatformUserSummaryDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  status!: UserStatus;
  isPlatformAdmin!: boolean;
  lastLoginAt!: string | null;
  createdAt!: string;

  static fromEntity(entity: UserEntity): PlatformUserSummaryDto {
    const dto = new PlatformUserSummaryDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.firstName = entity.firstName;
    dto.lastName = entity.lastName;
    dto.status = entity.status;
    dto.isPlatformAdmin = entity.isPlatformAdmin;
    dto.lastLoginAt = entity.lastLoginAt ? entity.lastLoginAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedPlatformUsersDto {
  items!: PlatformUserSummaryDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class PlatformUserMembershipDto {
  organizationId!: string;
  organizationName!: string;
  organizationSlug!: string;
  roleName!: string;
  status!: string;
  joinedAt!: string;
}

export class PlatformUserDetailDto extends PlatformUserSummaryDto {
  phoneNumber!: string | null;
  jobTitle!: string | null;
  mfaEnabled!: boolean;
  emailVerifiedAt!: string | null;
  memberships!: PlatformUserMembershipDto[];

  static fromEntityWithMemberships(
    entity: UserEntity,
    memberships: PlatformUserMembershipDto[],
  ): PlatformUserDetailDto {
    const summary = PlatformUserSummaryDto.fromEntity(entity);
    const dto = new PlatformUserDetailDto();
    Object.assign(dto, summary);
    dto.phoneNumber = entity.phoneNumber;
    dto.jobTitle = entity.jobTitle;
    dto.mfaEnabled = entity.mfaEnabled;
    dto.emailVerifiedAt = entity.emailVerifiedAt ? entity.emailVerifiedAt.toISOString() : null;
    dto.memberships = memberships;
    return dto;
  }
}
