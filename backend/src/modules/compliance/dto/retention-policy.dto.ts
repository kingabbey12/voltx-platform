import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { RetentionAction, RetentionPolicy, RetentionResourceType } from '@prisma/client';

export class CreateRetentionPolicyDto {
  @ApiProperty({ enum: RetentionResourceType })
  @IsEnum(RetentionResourceType)
  resourceType!: RetentionResourceType;

  @ApiProperty({
    description: 'Rows older than this many days become eligible for the configured action.',
  })
  @IsInt()
  @Min(1)
  retentionDays!: number;

  @ApiProperty({ enum: RetentionAction })
  @IsEnum(RetentionAction)
  action!: RetentionAction;
}

export class UpdateRetentionPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @ApiPropertyOptional({ enum: RetentionAction })
  @IsOptional()
  @IsEnum(RetentionAction)
  action?: RetentionAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RetentionPolicyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RetentionResourceType }) resourceType!: RetentionResourceType;
  @ApiProperty() retentionDays!: number;
  @ApiProperty({ enum: RetentionAction }) action!: RetentionAction;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;

  static fromModel(model: RetentionPolicy): RetentionPolicyResponseDto {
    const dto = new RetentionPolicyResponseDto();
    dto.id = model.id;
    dto.resourceType = model.resourceType;
    dto.retentionDays = model.retentionDays;
    dto.action = model.action;
    dto.isActive = model.isActive;
    dto.createdBy = model.createdBy;
    dto.createdAt = model.createdAt.toISOString();
    return dto;
  }
}
