import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { WorkflowScheduleEntity } from '../entities/workflow-support.entity';

const SCHEDULE_TRIGGER_TYPES = ['CRON', 'DELAYED', 'EVENT'] as const;

export class CreateWorkflowScheduleDto {
  @ApiProperty({ enum: SCHEDULE_TRIGGER_TYPES })
  @IsIn(SCHEDULE_TRIGGER_TYPES)
  triggerType!: 'CRON' | 'DELAYED' | 'EVENT';

  @ApiPropertyOptional({ example: '0 9 * * MON', description: 'Required for CRON schedules.' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ example: 3_600_000, description: 'Required for DELAYED schedules.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  delayMs?: number;

  @ApiPropertyOptional({
    example: 'sales.opportunity.closed_won',
    description: 'Required for EVENT schedules.',
  })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

export class SetScheduleEnabledDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

export class WorkflowScheduleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowId!: string;
  @ApiProperty({ enum: SCHEDULE_TRIGGER_TYPES }) triggerType!: 'CRON' | 'DELAYED' | 'EVENT';
  @ApiPropertyOptional() cronExpression!: string | null;
  @ApiPropertyOptional() delayMs!: number | null;
  @ApiPropertyOptional() eventName!: string | null;
  @ApiProperty() enabled!: boolean;
  @ApiPropertyOptional() nextRunAt!: string | null;
  @ApiPropertyOptional() lastRunAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowScheduleEntity): WorkflowScheduleResponseDto {
    const dto = new WorkflowScheduleResponseDto();
    dto.id = entity.id;
    dto.workflowId = entity.workflowId;
    dto.triggerType = entity.triggerType;
    dto.cronExpression = entity.cronExpression;
    dto.delayMs = entity.delayMs;
    dto.eventName = entity.eventName;
    dto.enabled = entity.enabled;
    dto.nextRunAt = entity.nextRunAt ? entity.nextRunAt.toISOString() : null;
    dto.lastRunAt = entity.lastRunAt ? entity.lastRunAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class WorkflowScheduleSuccessResponseDto extends ApiSuccessResponseDto<WorkflowScheduleResponseDto> {}
export class WorkflowSchedulesSuccessResponseDto extends ApiSuccessResponseDto<
  WorkflowScheduleResponseDto[]
> {}
