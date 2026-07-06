import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { SalesAiActionSuccessResponseDto } from '../../dto/sales-ai.dto';
import { ActivityEntity, ActivityType } from '../entities/activity.entity';

const activityTypes = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'] as const;

export class CreateActivityDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440102' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440103' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiProperty({ enum: activityTypes })
  @IsIn(activityTypes)
  type!: ActivityType;

  @ApiProperty({ example: 'Discovery call with procurement team' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiPropertyOptional({ example: 'Captured pricing concerns and rollout timeline.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-04T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: '2026-07-10T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ example: { owner: 'Adegoke' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class ListActivitiesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'discovery' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: activityTypes })
  @IsOptional()
  @IsIn(activityTypes)
  type?: ActivityType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440102' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440103' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;
}

export class ActivityResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440104' })
  id!: string;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  companyId!: string | null;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  contactId!: string | null;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440102' })
  leadId!: string | null;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440103' })
  opportunityId!: string | null;
  @ApiProperty({ enum: activityTypes })
  type!: ActivityType;
  @ApiProperty({ example: 'Discovery call with procurement team' })
  subject!: string;
  @ApiPropertyOptional({ example: 'Captured pricing concerns and rollout timeline.' })
  description!: string | null;
  @ApiPropertyOptional({ example: '2026-07-04T10:00:00.000Z' })
  occurredAt!: string | null;
  @ApiPropertyOptional({ example: '2026-07-10T10:00:00.000Z' })
  dueAt!: string | null;
  @ApiProperty({ example: false })
  completed!: boolean;
  @ApiPropertyOptional({
    example: 'Customer is interested in phased rollout and requested pricing recap.',
  })
  meetingSummary!: string | null;
  @ApiProperty({ example: { owner: 'Adegoke' } })
  metadata!: Record<string, unknown>;
  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;
  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: ActivityEntity): ActivityResponseDto {
    const dto = new ActivityResponseDto();
    dto.id = entity.id;
    dto.companyId = entity.companyId;
    dto.contactId = entity.contactId;
    dto.leadId = entity.leadId;
    dto.opportunityId = entity.opportunityId;
    dto.type = entity.type;
    dto.subject = entity.subject;
    dto.description = entity.description;
    dto.occurredAt = entity.occurredAt?.toISOString() ?? null;
    dto.dueAt = entity.dueAt?.toISOString() ?? null;
    dto.completed = entity.completed;
    dto.meetingSummary = entity.meetingSummary;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedActivitiesDto {
  @ApiProperty({ type: [ActivityResponseDto] })
  items!: ActivityResponseDto[];
  @ApiProperty({ example: 1 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class ActivitySuccessResponseDto extends ApiSuccessResponseDto<ActivityResponseDto> {}
export class PaginatedActivitiesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedActivitiesDto> {}
export class MeetingSummarySuccessResponseDto extends SalesAiActionSuccessResponseDto {}
