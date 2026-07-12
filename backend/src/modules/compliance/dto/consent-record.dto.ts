import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ConsentRecord } from '@prisma/client';

export class CreateConsentRecordDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Free-form consent category, e.g. "marketing_emails", "data_processing".',
  })
  @IsString()
  @MinLength(1)
  consentType!: string;

  @ApiProperty({
    description: 'true to grant, false to revoke — always appends a new history row.',
  })
  @IsBoolean()
  granted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ConsentRecordResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() consentType!: string;
  @ApiProperty() granted!: boolean;
  @ApiPropertyOptional({ nullable: true }) grantedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) revokedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromModel(model: ConsentRecord): ConsentRecordResponseDto {
    const dto = new ConsentRecordResponseDto();
    dto.id = model.id;
    dto.userId = model.userId;
    dto.consentType = model.consentType;
    dto.granted = model.granted;
    dto.grantedAt = model.grantedAt ? model.grantedAt.toISOString() : null;
    dto.revokedAt = model.revokedAt ? model.revokedAt.toISOString() : null;
    dto.createdAt = model.createdAt.toISOString();
    return dto;
  }
}
