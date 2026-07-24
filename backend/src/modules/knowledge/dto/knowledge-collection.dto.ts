import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  KnowledgeCollectionEntity,
  KnowledgeCollectionStatus,
} from '../entities/knowledge-collection.entity';

const KNOWLEDGE_COLLECTION_STATUSES: KnowledgeCollectionStatus[] = ['ACTIVE', 'ARCHIVED'];

export class CreateKnowledgeCollectionDto {
  @ApiProperty({ example: 'Product documentation' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Public help-center articles and API docs.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['docs', 'public'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: { team: 'support' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateKnowledgeCollectionDto {
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: KNOWLEDGE_COLLECTION_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_COLLECTION_STATUSES)
  status?: KnowledgeCollectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListKnowledgeCollectionsQueryDto {
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

  @ApiPropertyOptional({ enum: KNOWLEDGE_COLLECTION_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_COLLECTION_STATUSES)
  status?: KnowledgeCollectionStatus;
}

export class KnowledgeCollectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiProperty({ enum: KNOWLEDGE_COLLECTION_STATUSES }) status!: KnowledgeCollectionStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: KnowledgeCollectionEntity): KnowledgeCollectionResponseDto {
    const dto = new KnowledgeCollectionResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.tags = entity.tags;
    dto.metadata = entity.metadata;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedKnowledgeCollectionsDto {
  @ApiProperty({ type: [KnowledgeCollectionResponseDto] })
  items!: KnowledgeCollectionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class KnowledgeCollectionSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeCollectionResponseDto> {}
export class PaginatedKnowledgeCollectionsResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeCollectionsDto> {}
