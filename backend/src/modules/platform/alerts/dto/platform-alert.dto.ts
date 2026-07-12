import { PlatformAlertSeverity, PlatformAlertStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PlatformAlertEntity } from '../entities/platform-alert.entity';

export class CreatePlatformAlertDto {
  @IsEnum(PlatformAlertSeverity)
  severity!: PlatformAlertSeverity;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class ListPlatformAlertsQueryDto {
  @IsOptional()
  @IsEnum(PlatformAlertStatus)
  status?: PlatformAlertStatus;

  @IsOptional()
  @IsEnum(PlatformAlertSeverity)
  severity?: PlatformAlertSeverity;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  organizationId?: string;
}

export class PlatformAlertResponseDto {
  id!: string;
  severity!: PlatformAlertSeverity;
  category!: string;
  status!: PlatformAlertStatus;
  title!: string;
  description!: string | null;
  sourceMetadata!: Record<string, unknown>;
  organizationId!: string | null;
  acknowledgedById!: string | null;
  acknowledgedAt!: string | null;
  resolvedById!: string | null;
  resolvedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: PlatformAlertEntity): PlatformAlertResponseDto {
    const dto = new PlatformAlertResponseDto();
    dto.id = entity.id;
    dto.severity = entity.severity;
    dto.category = entity.category;
    dto.status = entity.status;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.sourceMetadata = entity.sourceMetadata;
    dto.organizationId = entity.organizationId;
    dto.acknowledgedById = entity.acknowledgedById;
    dto.acknowledgedAt = entity.acknowledgedAt ? entity.acknowledgedAt.toISOString() : null;
    dto.resolvedById = entity.resolvedById;
    dto.resolvedAt = entity.resolvedAt ? entity.resolvedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
