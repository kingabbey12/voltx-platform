import { ApiProperty } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { KnowledgeStats } from '../observability/knowledge-stats.service';

export class KnowledgeIndexSizeDto {
  @ApiProperty() sourceCount!: number;
  @ApiProperty() documentCount!: number;
  @ApiProperty() indexedDocumentCount!: number;
  @ApiProperty() pendingDocumentCount!: number;
  @ApiProperty() failedDocumentCount!: number;
  @ApiProperty() chunkCount!: number;
  @ApiProperty() entityCount!: number;
  @ApiProperty() relationshipCount!: number;
}

export class KnowledgeEmbeddingStatsDto {
  @ApiProperty() callCount!: number;
  @ApiProperty() averageLatencyMs!: number;
  @ApiProperty() totalCostUsd!: number;
}

export class KnowledgeRetrievalStatsDto {
  @ApiProperty() searchCount!: number;
  @ApiProperty() averageLatencyMs!: number;
  @ApiProperty() hitRate!: number;
  @ApiProperty() cacheHitRate!: number;
  @ApiProperty() averageConfidence!: number;
}

export class KnowledgeCacheStatsDto {
  @ApiProperty() hits!: number;
  @ApiProperty() misses!: number;
  @ApiProperty() writes!: number;
  @ApiProperty() invalidations!: number;
}

export class KnowledgeStatsDto {
  @ApiProperty({ type: KnowledgeIndexSizeDto }) indexSize!: KnowledgeIndexSizeDto;
  @ApiProperty({ type: KnowledgeEmbeddingStatsDto }) embedding!: KnowledgeEmbeddingStatsDto;
  @ApiProperty({ type: KnowledgeRetrievalStatsDto }) retrieval!: KnowledgeRetrievalStatsDto;
  @ApiProperty({ type: KnowledgeCacheStatsDto }) cache!: KnowledgeCacheStatsDto;

  static fromStats(stats: KnowledgeStats): KnowledgeStatsDto {
    const dto = new KnowledgeStatsDto();
    dto.indexSize = stats.indexSize;
    dto.embedding = stats.embedding;
    dto.retrieval = stats.retrieval;
    dto.cache = stats.cache;
    return dto;
  }
}

export class KnowledgeHealthDto {
  @ApiProperty() healthy!: boolean;
  @ApiProperty({ type: [String] }) reasons!: string[];
}

export class KnowledgeStatsSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeStatsDto> {}
export class KnowledgeHealthSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeHealthDto> {}
