import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  WorkflowCheckpointEntity,
  WorkflowDeadLetterEntity,
  WorkflowExecutionLogEntity,
  WorkflowLogLevel,
} from '../entities/workflow-support.entity';
import { WorkflowMetrics } from '../observability/workflow-stats.service';

export class ListWorkflowLogsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class ListWorkflowDeadLettersQueryDto {
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
}

export class WorkflowLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowRunId!: string;
  @ApiPropertyOptional() stepRunId!: string | null;
  @ApiProperty({ enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] }) level!: WorkflowLogLevel;
  @ApiProperty() event!: string;
  @ApiProperty() message!: string;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowExecutionLogEntity): WorkflowLogResponseDto {
    const dto = new WorkflowLogResponseDto();
    dto.id = entity.id;
    dto.workflowRunId = entity.workflowRunId;
    dto.stepRunId = entity.stepRunId;
    dto.level = entity.level;
    dto.event = entity.event;
    dto.message = entity.message;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedWorkflowLogsDto {
  @ApiProperty({ type: [WorkflowLogResponseDto] }) items!: WorkflowLogResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class WorkflowMetricsDto {
  @ApiProperty() totalRuns!: number;
  @ApiProperty() succeededRuns!: number;
  @ApiProperty() failedRuns!: number;
  @ApiProperty() cancelledRuns!: number;
  @ApiProperty() successRate!: number;
  @ApiProperty() failureRate!: number;
  @ApiProperty() averageExecutionTimeMs!: number;
  @ApiProperty() averageQueueTimeMs!: number;
  @ApiProperty() totalRetries!: number;
  @ApiProperty() agentStepCount!: number;
  @ApiProperty() toolStepCount!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() totalCostUsd!: number;

  static fromMetrics(metrics: WorkflowMetrics): WorkflowMetricsDto {
    return Object.assign(new WorkflowMetricsDto(), metrics);
  }
}

export class WorkflowHealthDto {
  @ApiProperty() healthy!: boolean;
  @ApiProperty({ type: [String] }) reasons!: string[];
}

export class WorkflowCheckpointResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowRunId!: string;
  @ApiProperty() stepId!: string;
  @ApiProperty() state!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowCheckpointEntity): WorkflowCheckpointResponseDto {
    const dto = new WorkflowCheckpointResponseDto();
    dto.id = entity.id;
    dto.workflowRunId = entity.workflowRunId;
    dto.stepId = entity.stepId;
    dto.state = entity.state;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class WorkflowDeadLetterResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowRunId!: string;
  @ApiProperty() stepId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowDeadLetterEntity): WorkflowDeadLetterResponseDto {
    const dto = new WorkflowDeadLetterResponseDto();
    dto.id = entity.id;
    dto.workflowRunId = entity.workflowRunId;
    dto.stepId = entity.stepId;
    dto.reason = entity.reason;
    dto.payload = entity.payload;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedWorkflowDeadLettersDto {
  @ApiProperty({ type: [WorkflowDeadLetterResponseDto] }) items!: WorkflowDeadLetterResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class PaginatedWorkflowLogsResponseDto extends ApiSuccessResponseDto<PaginatedWorkflowLogsDto> {}
export class WorkflowMetricsSuccessResponseDto extends ApiSuccessResponseDto<WorkflowMetricsDto> {}
export class WorkflowHealthSuccessResponseDto extends ApiSuccessResponseDto<WorkflowHealthDto> {}
export class WorkflowCheckpointsSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowCheckpointResponseDto[]
> {}
export class PaginatedWorkflowDeadLettersResponseDto extends ApiSuccessResponseDto<PaginatedWorkflowDeadLettersDto> {}
