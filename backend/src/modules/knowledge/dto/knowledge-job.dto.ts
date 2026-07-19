import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  KnowledgeIngestionJobEntity,
  KnowledgeIngestionJobStatus,
} from '../entities/knowledge-ingestion-job.entity';

const KNOWLEDGE_INGESTION_JOB_STATUSES: KnowledgeIngestionJobStatus[] = [
  'QUEUED',
  'EXTRACTING',
  'CHUNKING',
  'EMBEDDING',
  'INDEXING',
  'READY',
  'FAILED',
  'CANCELLED',
];

export class ListKnowledgeJobsQueryDto {
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

  @ApiPropertyOptional({ enum: KNOWLEDGE_INGESTION_JOB_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_INGESTION_JOB_STATUSES)
  status?: KnowledgeIngestionJobStatus;
}

export class KnowledgeIngestionJobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceId!: string;
  @ApiPropertyOptional() documentId!: string | null;
  @ApiProperty({ enum: KNOWLEDGE_INGESTION_JOB_STATUSES }) status!: KnowledgeIngestionJobStatus;
  @ApiProperty() progressPercent!: number;
  @ApiProperty() attemptsMade!: number;
  @ApiProperty() maxAttempts!: number;
  @ApiPropertyOptional() cancellationRequestedAt!: string | null;
  @ApiPropertyOptional() startedAt!: string | null;
  @ApiPropertyOptional() completedAt!: string | null;
  @ApiPropertyOptional() lastError!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: KnowledgeIngestionJobEntity): KnowledgeIngestionJobResponseDto {
    const dto = new KnowledgeIngestionJobResponseDto();
    dto.id = entity.id;
    dto.sourceId = entity.sourceId;
    dto.documentId = entity.documentId;
    dto.status = entity.status;
    dto.progressPercent = entity.progressPercent;
    dto.attemptsMade = entity.attemptsMade;
    dto.maxAttempts = entity.maxAttempts;
    dto.cancellationRequestedAt = entity.cancellationRequestedAt?.toISOString() ?? null;
    dto.startedAt = entity.startedAt?.toISOString() ?? null;
    dto.completedAt = entity.completedAt?.toISOString() ?? null;
    dto.lastError = entity.lastError;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedKnowledgeIngestionJobsDto {
  @ApiProperty({ type: [KnowledgeIngestionJobResponseDto] })
  items!: KnowledgeIngestionJobResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class KnowledgeIngestionJobSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeIngestionJobResponseDto> {}
export class PaginatedKnowledgeIngestionJobsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeIngestionJobsDto> {}
