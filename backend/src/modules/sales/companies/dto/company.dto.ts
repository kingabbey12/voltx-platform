import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { CompanyEntity, CompanyStatus } from '../entities/company.entity';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Energy' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'acme.energy' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @ApiPropertyOptional({ example: 'https://acme.energy' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ example: 'Energy' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ enum: ['PROSPECT', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['PROSPECT', 'ACTIVE', 'INACTIVE'])
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: 'Strategic prospect for Q3 expansion.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: { region: 'EMEA' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Energy' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'acme.energy' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @ApiPropertyOptional({ example: 'https://acme.energy' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ example: 'Energy' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ enum: ['PROSPECT', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['PROSPECT', 'ACTIVE', 'INACTIVE'])
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: 'Strategic prospect for Q3 expansion.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: { region: 'EMEA' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListCompaniesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'acme' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ['PROSPECT', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['PROSPECT', 'ACTIVE', 'INACTIVE'])
  status?: CompanyStatus;
}

export class CompanyResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id!: string;

  @ApiProperty({ example: 'Acme Energy' })
  name!: string;

  @ApiPropertyOptional({ example: 'acme.energy' })
  domain!: string | null;

  @ApiPropertyOptional({ example: 'https://acme.energy' })
  website!: string | null;

  @ApiPropertyOptional({ example: 'Energy' })
  industry!: string | null;

  @ApiProperty({ enum: ['PROSPECT', 'ACTIVE', 'INACTIVE'] })
  status!: CompanyStatus;

  @ApiPropertyOptional({ example: 'Strategic prospect for Q3 expansion.' })
  notes!: string | null;

  @ApiProperty({ example: { region: 'EMEA' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: CompanyEntity): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.domain = entity.domain;
    dto.website = entity.website;
    dto.industry = entity.industry;
    dto.status = entity.status;
    dto.notes = entity.notes;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedCompaniesDto {
  @ApiProperty({ type: [CompanyResponseDto] })
  items!: CompanyResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class CompanySuccessResponseDto extends ApiSuccessResponseDto<CompanyResponseDto> {}
export class PaginatedCompaniesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedCompaniesDto> {}
