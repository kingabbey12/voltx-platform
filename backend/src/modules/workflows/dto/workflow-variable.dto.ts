import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowVariableEntity, WorkflowVariableType } from '../entities/workflow-variable.entity';

const VARIABLE_TYPES: WorkflowVariableType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'];

export class CreateWorkflowVariableDto {
  @ApiProperty({ example: 'default_sender_name' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key!: string;

  @ApiPropertyOptional({ enum: VARIABLE_TYPES, default: 'STRING' })
  @IsOptional()
  @IsIn(VARIABLE_TYPES)
  type?: WorkflowVariableType;

  @ApiPropertyOptional({ example: 'Voltx Sales Team' })
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional({ example: 'Used as the From name on generated emails.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateWorkflowVariableDto {
  @ApiPropertyOptional({ enum: VARIABLE_TYPES })
  @IsOptional()
  @IsIn(VARIABLE_TYPES)
  type?: WorkflowVariableType;

  @ApiPropertyOptional()
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class WorkflowVariableResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() workflowId!: string | null;
  @ApiProperty() key!: string;
  @ApiProperty({ enum: VARIABLE_TYPES }) type!: WorkflowVariableType;
  @ApiPropertyOptional() defaultValue!: unknown;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowVariableEntity): WorkflowVariableResponseDto {
    const dto = new WorkflowVariableResponseDto();
    dto.id = entity.id;
    dto.workflowId = entity.workflowId;
    dto.key = entity.key;
    dto.type = entity.type;
    dto.defaultValue = entity.defaultValue;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class WorkflowVariableSuccessResponseDto extends ApiSuccessResponseDto<WorkflowVariableResponseDto> {}
export class WorkflowVariableListSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowVariableResponseDto[]
> {}
