import { Type } from 'class-transformer';
import {
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
import { LeadEntity, LeadStatus } from '../entities/lead.entity';

const leadStatuses = ['NEW', 'QUALIFIED', 'NURTURING', 'DISQUALIFIED', 'CONVERTED'] as const;

export class CreateLeadDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty({ example: 'Acme Energy - Procurement Transformation' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Inbound demo request' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @ApiPropertyOptional({ enum: leadStatuses })
  @IsOptional()
  @IsIn(leadStatuses)
  status?: LeadStatus;

  @ApiPropertyOptional({ example: 'Interest in consolidating energy data reporting.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: { segment: 'Enterprise' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class ListLeadsQueryDto {
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

  @ApiPropertyOptional({ example: 'acme' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: leadStatuses })
  @IsOptional()
  @IsIn(leadStatuses)
  status?: LeadStatus;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class LeadResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440102' })
  id!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  companyId!: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  contactId!: string | null;

  @ApiProperty({ example: 'Acme Energy - Procurement Transformation' })
  title!: string;

  @ApiPropertyOptional({ example: 'Inbound demo request' })
  source!: string | null;

  @ApiProperty({ enum: leadStatuses })
  status!: LeadStatus;

  @ApiPropertyOptional({ example: 78 })
  qualificationScore!: number | null;

  @ApiPropertyOptional({
    example: 'High-fit lead with strong urgency and identified executive sponsor.',
  })
  qualificationSummary!: string | null;

  @ApiPropertyOptional({ example: 'Interest in consolidating energy data reporting.' })
  notes!: string | null;

  @ApiProperty({ example: { segment: 'Enterprise' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: LeadEntity): LeadResponseDto {
    const dto = new LeadResponseDto();
    dto.id = entity.id;
    dto.companyId = entity.companyId;
    dto.contactId = entity.contactId;
    dto.title = entity.title;
    dto.source = entity.source;
    dto.status = entity.status;
    dto.qualificationScore = entity.qualificationScore;
    dto.qualificationSummary = entity.qualificationSummary;
    dto.notes = entity.notes;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedLeadsDto {
  @ApiProperty({ type: [LeadResponseDto] })
  items!: LeadResponseDto[];
  @ApiProperty({ example: 1 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class LeadSuccessResponseDto extends ApiSuccessResponseDto<LeadResponseDto> {}
export class PaginatedLeadsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedLeadsDto> {}
export class LeadQualificationSuccessResponseDto extends SalesAiActionSuccessResponseDto {}
