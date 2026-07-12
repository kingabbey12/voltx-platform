import { OrganizationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrganizationEntity } from '../../../organization/entities/organization.entity';

export class ListPlatformOrganizationsQueryDto {
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
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class PlatformOrganizationSummaryDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: OrganizationStatus;
  parentOrganizationId!: string | null;
  memberCount!: number;
  createdAt!: string;

  static fromEntity(
    entity: OrganizationEntity,
    memberCount: number,
  ): PlatformOrganizationSummaryDto {
    const dto = new PlatformOrganizationSummaryDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.status = entity.status;
    dto.parentOrganizationId = entity.parentOrganizationId;
    dto.memberCount = memberCount;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedPlatformOrganizationsDto {
  items!: PlatformOrganizationSummaryDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class PlatformOrganizationDetailDto extends PlatformOrganizationSummaryDto {
  email!: string | null;
  industry!: string | null;
  country!: string | null;
  timezone!: string;
  onboardingCompletedAt!: string | null;
  updatedAt!: string;

  static override fromEntity(
    entity: OrganizationEntity,
    memberCount: number,
  ): PlatformOrganizationDetailDto {
    const dto = new PlatformOrganizationDetailDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.status = entity.status;
    dto.parentOrganizationId = entity.parentOrganizationId;
    dto.memberCount = memberCount;
    dto.createdAt = entity.createdAt.toISOString();
    dto.email = entity.email;
    dto.industry = entity.industry;
    dto.country = entity.country;
    dto.timezone = entity.timezone;
    dto.onboardingCompletedAt = entity.onboardingCompletedAt
      ? entity.onboardingCompletedAt.toISOString()
      : null;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
