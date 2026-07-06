import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowDefinition } from '../definition/workflow-definition.types';
import { WorkflowEntity, WorkflowStatus } from '../entities/workflow.entity';
import { WorkflowVersionEntity } from '../entities/workflow-version.entity';

const WORKFLOW_STATUSES: WorkflowStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export class CreateWorkflowDto {
  @ApiProperty({ example: 'New Deal Onboarding' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Runs when a new opportunity is marked closed-won.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'The step DAG — validated server-side by WorkflowDefinitionValidatorService.',
    example: {
      steps: [
        {
          id: 'summarize',
          name: 'Summarize the deal',
          type: 'AGENT',
          config: { agentName: 'Sales Assistant', objective: 'Summarize the closed-won deal.' },
        },
      ],
    },
  })
  @IsObject()
  definition!: WorkflowDefinition;
}

export class UpdateWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Providing this creates a new WorkflowVersion.' })
  @IsOptional()
  @IsObject()
  definition?: WorkflowDefinition;
}

export class ListWorkflowsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: WORKFLOW_STATUSES })
  @IsOptional()
  @IsIn(WORKFLOW_STATUSES)
  status?: WorkflowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}

export class WorkflowResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ enum: WORKFLOW_STATUSES }) status!: WorkflowStatus;
  @ApiPropertyOptional() publishedVersion!: number | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: WorkflowEntity): WorkflowResponseDto {
    const dto = new WorkflowResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.publishedVersion = entity.publishedVersion;
    dto.createdBy = entity.createdBy;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class WorkflowVersionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() definition!: WorkflowDefinition;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowVersionEntity): WorkflowVersionResponseDto {
    const dto = new WorkflowVersionResponseDto();
    dto.id = entity.id;
    dto.workflowId = entity.workflowId;
    dto.version = entity.version;
    dto.definition = entity.definition;
    dto.createdBy = entity.createdBy;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedWorkflowsDto {
  @ApiProperty({ type: [WorkflowResponseDto] }) items!: WorkflowResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class WorkflowSuccessResponseDto extends ApiSuccessResponseDto<WorkflowResponseDto> {}
export class PaginatedWorkflowsResponseDto extends ApiSuccessResponseDto<PaginatedWorkflowsDto> {}
export class WorkflowVersionsSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowVersionResponseDto[]
> {}
