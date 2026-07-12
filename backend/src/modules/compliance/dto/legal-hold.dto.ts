import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LegalHold } from '@prisma/client';

export class CreateLegalHoldDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ description: 'Scopes the hold to one user; omit for an org-wide hold.' })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;
}

export class UpdateLegalHoldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;
}

export class LegalHoldResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ nullable: true }) targetUserId!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() scope!: Record<string, unknown>;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional({ nullable: true }) releasedBy!: string | null;
  @ApiPropertyOptional({ nullable: true }) releasedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromModel(model: LegalHold): LegalHoldResponseDto {
    const dto = new LegalHoldResponseDto();
    dto.id = model.id;
    dto.name = model.name;
    dto.reason = model.reason;
    dto.targetUserId = model.targetUserId;
    dto.status = model.status;
    dto.scope = model.scope as Record<string, unknown>;
    dto.createdBy = model.createdBy;
    dto.releasedBy = model.releasedBy;
    dto.releasedAt = model.releasedAt ? model.releasedAt.toISOString() : null;
    dto.createdAt = model.createdAt.toISOString();
    return dto;
  }
}
