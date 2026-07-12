import { SupportSessionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SupportSessionEntity } from '../entities/support-session.entity';

export class StartSupportSessionDto {
  @IsUUID()
  targetOrganizationId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class ListSupportSessionsQueryDto {
  @IsOptional()
  @IsEnum(SupportSessionStatus)
  status?: SupportSessionStatus;

  @IsOptional()
  @IsUUID()
  targetOrganizationId?: string;
}

export class SupportSessionResponseDto {
  id!: string;
  platformAdminUserId!: string;
  targetOrganizationId!: string;
  reason!: string;
  status!: SupportSessionStatus;
  expiresAt!: string;
  endedAt!: string | null;
  endedById!: string | null;
  createdAt!: string;

  static fromEntity(entity: SupportSessionEntity): SupportSessionResponseDto {
    const dto = new SupportSessionResponseDto();
    dto.id = entity.id;
    dto.platformAdminUserId = entity.platformAdminUserId;
    dto.targetOrganizationId = entity.targetOrganizationId;
    dto.reason = entity.reason;
    dto.status = entity.status;
    dto.expiresAt = entity.expiresAt.toISOString();
    dto.endedAt = entity.endedAt ? entity.endedAt.toISOString() : null;
    dto.endedById = entity.endedById;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class StartSupportSessionResponseDto {
  session!: SupportSessionResponseDto;
  accessToken!: string;
  tokenType!: 'Bearer';
  expiresIn!: number;
}
