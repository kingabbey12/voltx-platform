import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowDefinition } from '../definition/workflow-definition.types';
import { WorkflowTemplateEntity } from '../entities/workflow-template.entity';
import { WorkflowResponseDto } from './workflow.dto';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ example: 'lead-follow-up' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key!: string;

  @ApiProperty({ example: 'Lead Follow-Up' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Follows up with a new lead within one business day.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'sales' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiProperty({ description: 'The step DAG — validated the same way a workflow definition is.' })
  @IsObject()
  definition!: WorkflowDefinition;
}

export class InstantiateWorkflowTemplateDto {
  @ApiPropertyOptional({ example: 'My Lead Follow-Up' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;
}

export class WorkflowTemplateResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() organizationId!: string | null;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() category!: string;
  @ApiProperty() definition!: WorkflowDefinition;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: WorkflowTemplateEntity): WorkflowTemplateResponseDto {
    const dto = new WorkflowTemplateResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.category = entity.category;
    dto.definition = entity.definition;
    dto.isSystem = entity.isSystem;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedWorkflowTemplatesResponseDto {
  @ApiProperty({ type: [WorkflowTemplateResponseDto] }) items!: WorkflowTemplateResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class WorkflowTemplateSuccessResponseDto extends ApiSuccessResponseDto<WorkflowTemplateResponseDto> {}

/** Instantiating a template creates a real Workflow, so the response is a WorkflowResponseDto, not a template. */
export class InstantiatedWorkflowSuccessResponseDto extends ApiSuccessResponseDto<WorkflowResponseDto> {}
