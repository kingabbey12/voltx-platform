import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { AgentScheduleEntity, AgentScheduleTriggerType } from '../scheduling/agent-schedule.entity';

export class CreateAgentScheduleDto {
  @ApiProperty({ enum: ['CRON', 'EVENT'], example: 'CRON' })
  @IsIn(['CRON', 'EVENT'])
  triggerType!: AgentScheduleTriggerType;

  @ApiPropertyOptional({ example: '0 9 * * MON', description: 'Required when triggerType is CRON.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cronExpression?: string;

  @ApiPropertyOptional({ example: 'lead.created', description: 'Required when triggerType is EVENT.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventName?: string;

  @ApiPropertyOptional({ example: { objective: 'Summarize this week\'s pipeline changes.' } })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

export class UpdateAgentScheduleEnabledDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

export class AgentScheduleResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440060' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  agentId!: string;

  @ApiProperty({ enum: ['CRON', 'EVENT'], example: 'CRON' })
  triggerType!: AgentScheduleTriggerType;

  @ApiPropertyOptional({ example: '0 9 * * MON' })
  cronExpression!: string | null;

  @ApiPropertyOptional({ example: null })
  eventName!: string | null;

  @ApiProperty({ example: {} })
  input!: Record<string, unknown>;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiPropertyOptional({ example: null })
  nextRunAt!: string | null;

  @ApiPropertyOptional({ example: '2026-07-10T09:00:00.000Z' })
  lastRunAt!: string | null;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: AgentScheduleEntity): AgentScheduleResponseDto {
    const dto = new AgentScheduleResponseDto();
    dto.id = entity.id;
    dto.agentId = entity.agentId;
    dto.triggerType = entity.triggerType;
    dto.cronExpression = entity.cronExpression;
    dto.eventName = entity.eventName;
    dto.input = entity.input;
    dto.enabled = entity.enabled;
    dto.nextRunAt = entity.nextRunAt ? entity.nextRunAt.toISOString() : null;
    dto.lastRunAt = entity.lastRunAt ? entity.lastRunAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class AgentScheduleSuccessResponseDto extends ApiSuccessResponseDto<AgentScheduleResponseDto> {}
export class AgentSchedulesSuccessResponseDto extends ApiSuccessResponseDto<
  AgentScheduleResponseDto[]
> {}
