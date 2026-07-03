import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrganizationEntity } from '../entities/organization.entity';

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional({ example: 'acme', description: 'Filter by name or slug' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class OrganizationResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name!: string;

  @ApiProperty({ example: 'acme-corporation' })
  slug!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logos/acme.png', nullable: true })
  logoUrl!: string | null;

  @ApiPropertyOptional({ example: 'Technology', nullable: true })
  industry!: string | null;

  @ApiPropertyOptional({ example: 'US', nullable: true })
  country!: string | null;

  @ApiProperty({ example: 'America/New_York' })
  timezone!: string;

  @ApiProperty({ enum: OrganizationStatus, example: OrganizationStatus.ACTIVE })
  status!: OrganizationStatus;

  @ApiProperty({
    example: { theme: 'dark' },
    type: 'object',
    additionalProperties: true,
  })
  settings!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: OrganizationEntity): OrganizationResponseDto {
    const dto = new OrganizationResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.logoUrl = entity.logoUrl;
    dto.industry = entity.industry;
    dto.country = entity.country;
    dto.timezone = entity.timezone;
    dto.status = entity.status;
    dto.settings = entity.settings;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedOrganizationsDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  items!: OrganizationResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
