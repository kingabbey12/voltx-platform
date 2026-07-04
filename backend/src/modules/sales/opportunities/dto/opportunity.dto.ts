import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { SalesAiActionSuccessResponseDto } from '../../dto/sales-ai.dto';
import { OpportunityEntity, OpportunityStage } from '../entities/opportunity.entity';

const stages = [
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

export class CreateOpportunityDto {
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

  @ApiProperty({ example: 'Acme Energy Expansion - EMEA' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ enum: stages })
  @IsOptional()
  @IsIn(stages)
  stage?: OpportunityStage;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 65, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ example: '2026-08-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedCloseAt?: string;

  @ApiPropertyOptional({ example: 'Executive review scheduled for next week.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: { segment: 'Enterprise' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateOpportunityDto extends CreateOpportunityDto {}

export class ListOpportunitiesQueryDto {
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

  @ApiPropertyOptional({ enum: stages })
  @IsOptional()
  @IsIn(stages)
  stage?: OpportunityStage;

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
}

export class OpportunityResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440103' })
  id!: string;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  companyId!: string | null;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440101' })
  contactId!: string | null;
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440102' })
  leadId!: string | null;
  @ApiProperty({ example: 'Acme Energy Expansion - EMEA' })
  title!: string;
  @ApiProperty({ enum: stages })
  stage!: OpportunityStage;
  @ApiPropertyOptional({ example: 125000 })
  amount!: number | null;
  @ApiProperty({ example: 'USD' })
  currency!: string;
  @ApiProperty({ example: 65 })
  probability!: number;
  @ApiPropertyOptional({ example: '2026-08-31T00:00:00.000Z' })
  expectedCloseAt!: string | null;
  @ApiPropertyOptional({ example: 'Summary of deal insights.' })
  insights!: string | null;
  @ApiPropertyOptional({ example: 'Book executive alignment review.' })
  nextBestAction!: string | null;
  @ApiPropertyOptional({ example: 'Executive review scheduled for next week.' })
  notes!: string | null;
  @ApiProperty({ example: { segment: 'Enterprise' } })
  metadata!: Record<string, unknown>;
  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;
  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: OpportunityEntity): OpportunityResponseDto {
    const dto = new OpportunityResponseDto();
    dto.id = entity.id;
    dto.companyId = entity.companyId;
    dto.contactId = entity.contactId;
    dto.leadId = entity.leadId;
    dto.title = entity.title;
    dto.stage = entity.stage;
    dto.amount = entity.amount;
    dto.currency = entity.currency;
    dto.probability = entity.probability;
    dto.expectedCloseAt = entity.expectedCloseAt?.toISOString() ?? null;
    dto.insights = entity.insights;
    dto.nextBestAction = entity.nextBestAction;
    dto.notes = entity.notes;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedOpportunitiesDto {
  @ApiProperty({ type: [OpportunityResponseDto] })
  items!: OpportunityResponseDto[];
  @ApiProperty({ example: 1 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class OpportunitySuccessResponseDto extends ApiSuccessResponseDto<OpportunityResponseDto> {}
export class PaginatedOpportunitiesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedOpportunitiesDto> {}
export class OpportunityInsightsSuccessResponseDto extends SalesAiActionSuccessResponseDto {}
export class OpportunityNextActionSuccessResponseDto extends SalesAiActionSuccessResponseDto {}
