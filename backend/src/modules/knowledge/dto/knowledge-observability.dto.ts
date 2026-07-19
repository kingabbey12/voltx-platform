import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { KnowledgeChunkWithContext } from '../entities/knowledge-chunk.entity';
import { KnowledgeSearchLogEntity } from '../observability/knowledge-search-log.repository';

export class KnowledgePaginationQueryDto {
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

export class ListKnowledgeChunksQueryDto extends KnowledgePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter chunks to a document id' })
  @IsOptional()
  documentId?: string;
}

export class KnowledgeChunkResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() documentId!: string;
  @ApiProperty() documentTitle!: string;
  @ApiProperty() sourceId!: string;
  @ApiProperty() sourceName!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() chunkIndex!: number;
  @ApiProperty() content!: string;
  @ApiProperty() tokenCount!: number;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: KnowledgeChunkWithContext): KnowledgeChunkResponseDto {
    const dto = new KnowledgeChunkResponseDto();
    dto.id = entity.id;
    dto.documentId = entity.documentId;
    dto.documentTitle = entity.documentTitle;
    dto.sourceId = entity.sourceId;
    dto.sourceName = entity.sourceName;
    dto.sourceType = entity.sourceType;
    dto.chunkIndex = entity.chunkIndex;
    dto.content = entity.content;
    dto.tokenCount = entity.tokenCount;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedKnowledgeChunksDto {
  @ApiProperty({ type: [KnowledgeChunkResponseDto] }) items!: KnowledgeChunkResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class KnowledgeSearchLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() query!: string;
  @ApiProperty() resultCount!: number;
  @ApiProperty() citedResultCount!: number;
  @ApiPropertyOptional() topConfidence!: number | null;
  @ApiPropertyOptional() averageConfidence!: number | null;
  @ApiProperty() latencyMs!: number;
  @ApiPropertyOptional() rerankLatencyMs!: number | null;
  @ApiProperty() cacheHit!: boolean;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: KnowledgeSearchLogEntity): KnowledgeSearchLogResponseDto {
    const dto = new KnowledgeSearchLogResponseDto();
    dto.id = entity.id;
    dto.query = entity.query;
    dto.resultCount = entity.resultCount;
    dto.citedResultCount = entity.citedResultCount;
    dto.topConfidence = entity.topConfidence;
    dto.averageConfidence = entity.averageConfidence;
    dto.latencyMs = entity.latencyMs;
    dto.rerankLatencyMs = entity.rerankLatencyMs;
    dto.cacheHit = entity.cacheHit;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedKnowledgeSearchLogsDto {
  @ApiProperty({ type: [KnowledgeSearchLogResponseDto] }) items!: KnowledgeSearchLogResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class PaginatedKnowledgeChunksSuccessResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeChunksDto> {}
export class PaginatedKnowledgeSearchLogsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeSearchLogsDto> {}
