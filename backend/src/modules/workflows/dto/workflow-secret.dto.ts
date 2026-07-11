import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowSecretEntity } from '../entities/workflow-secret.entity';

export class CreateWorkflowSecretDto {
  @ApiProperty({ example: 'STRIPE_API_KEY' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key!: string;

  @ApiProperty({ example: 'sk_live_...', description: 'Never returned by any read endpoint.' })
  @IsString()
  @MinLength(1)
  value!: string;

  @ApiPropertyOptional({ example: 'Used by the invoice-reminder workflow.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class RotateWorkflowSecretDto {
  @ApiProperty({ example: 'sk_live_new_value' })
  @IsString()
  @MinLength(1)
  value!: string;
}

export class WorkflowSecretResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiPropertyOptional() lastRotatedAt!: string | null;
  @ApiPropertyOptional() lastUsedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowSecretEntity): WorkflowSecretResponseDto {
    const dto = new WorkflowSecretResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.description = entity.description;
    dto.lastRotatedAt = entity.lastRotatedAt ? entity.lastRotatedAt.toISOString() : null;
    dto.lastUsedAt = entity.lastUsedAt ? entity.lastUsedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class WorkflowSecretSuccessResponseDto extends ApiSuccessResponseDto<WorkflowSecretResponseDto> {}
export class WorkflowSecretListSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowSecretResponseDto[]
> {}
