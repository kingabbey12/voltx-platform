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
import {
  KnowledgeSourceEntity,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
} from '../entities/knowledge-source.entity';

const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceType[] = [
  'CRM_CONTACT',
  'CRM_COMPANY',
  'CRM_OPPORTUNITY',
  'CRM_ACTIVITY',
  'NOTE',
  'DOCUMENT',
  'EMAIL',
  'CALENDAR',
  'TASK',
  'MEETING',
  'UPLOADED_FILE',
  'AI_MEMORY',
  'OTHER',
];

const KNOWLEDGE_SOURCE_STATUSES: KnowledgeSourceStatus[] = ['ACTIVE', 'PAUSED', 'ERROR'];

export class CreateKnowledgeSourceDto {
  @ApiProperty({ enum: KNOWLEDGE_SOURCE_TYPES })
  @IsIn(KNOWLEDGE_SOURCE_TYPES)
  type!: KnowledgeSourceType;

  @ApiProperty({ example: 'Salesforce Opportunities' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Synced opportunity records from Salesforce.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: { syncIntervalMinutes: 60 } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateKnowledgeSourceDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: KNOWLEDGE_SOURCE_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_SOURCE_STATUSES)
  status?: KnowledgeSourceStatus;
}

export class ListKnowledgeSourcesQueryDto {
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

  @ApiPropertyOptional({ enum: KNOWLEDGE_SOURCE_TYPES })
  @IsOptional()
  @IsIn(KNOWLEDGE_SOURCE_TYPES)
  type?: KnowledgeSourceType;

  @ApiPropertyOptional({ enum: KNOWLEDGE_SOURCE_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_SOURCE_STATUSES)
  status?: KnowledgeSourceStatus;
}

export class KnowledgeSourceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: KNOWLEDGE_SOURCE_TYPES })
  type!: KnowledgeSourceType;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  config!: Record<string, unknown>;

  @ApiProperty({ enum: KNOWLEDGE_SOURCE_STATUSES })
  status!: KnowledgeSourceStatus;

  @ApiPropertyOptional()
  lastIndexedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromEntity(entity: KnowledgeSourceEntity): KnowledgeSourceResponseDto {
    const dto = new KnowledgeSourceResponseDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.config = entity.config;
    dto.status = entity.status;
    dto.lastIndexedAt = entity.lastIndexedAt ? entity.lastIndexedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedKnowledgeSourcesDto {
  @ApiProperty({ type: [KnowledgeSourceResponseDto] })
  items!: KnowledgeSourceResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class KnowledgeSourceSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeSourceResponseDto> {}
export class PaginatedKnowledgeSourcesResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeSourcesDto> {}
