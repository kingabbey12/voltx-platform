import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  WorkflowRunEntity,
  WorkflowRunStatus,
  WorkflowTriggerType,
} from '../entities/workflow-run.entity';

const WORKFLOW_RUN_STATUSES: WorkflowRunStatus[] = [
  'PENDING',
  'RUNNING',
  'PAUSED',
  'WAITING_APPROVAL',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
];

export class RunWorkflowDto {
  @ApiPropertyOptional({ example: { dealId: 'sf-opp-00123' } })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'closed-won-sf-opp-00123',
    description: 'Repeating this key returns the existing run instead of starting a duplicate.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}

export class ListWorkflowRunsQueryDto {
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

  @ApiPropertyOptional({ enum: WORKFLOW_RUN_STATUSES })
  @IsOptional()
  @IsIn(WORKFLOW_RUN_STATUSES)
  status?: WorkflowRunStatus;
}

export class WorkflowRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowId!: string;
  @ApiProperty() workflowVersionId!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty({ enum: WORKFLOW_RUN_STATUSES }) status!: WorkflowRunStatus;
  @ApiProperty() triggerType!: WorkflowTriggerType;
  @ApiProperty() input!: Record<string, unknown>;
  @ApiProperty() context!: Record<string, unknown>;
  @ApiProperty() output!: Record<string, unknown>;
  @ApiPropertyOptional() currentStepId!: string | null;
  @ApiPropertyOptional() error!: string | null;
  @ApiProperty() version!: number;
  @ApiPropertyOptional() startedAt!: string | null;
  @ApiPropertyOptional() completedAt!: string | null;
  @ApiPropertyOptional() durationMs!: number | null;
  @ApiProperty() queuedAt!: string;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowRunEntity): WorkflowRunResponseDto {
    const dto = new WorkflowRunResponseDto();
    dto.id = entity.id;
    dto.workflowId = entity.workflowId;
    dto.workflowVersionId = entity.workflowVersionId;
    dto.conversationId = entity.conversationId;
    dto.status = entity.status;
    dto.triggerType = entity.triggerType;
    dto.input = entity.input;
    dto.context = entity.context;
    dto.output = entity.output;
    dto.currentStepId = entity.currentStepId;
    dto.error = entity.error;
    dto.version = entity.version;
    dto.startedAt = entity.startedAt ? entity.startedAt.toISOString() : null;
    dto.completedAt = entity.completedAt ? entity.completedAt.toISOString() : null;
    dto.durationMs = entity.durationMs;
    dto.queuedAt = entity.queuedAt.toISOString();
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedWorkflowRunsDto {
  @ApiProperty({ type: [WorkflowRunResponseDto] }) items!: WorkflowRunResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class WorkflowRunSuccessResponseDto extends ApiSuccessResponseDto<WorkflowRunResponseDto> {}
export class PaginatedWorkflowRunsResponseDto extends ApiSuccessResponseDto<PaginatedWorkflowRunsDto> {}
