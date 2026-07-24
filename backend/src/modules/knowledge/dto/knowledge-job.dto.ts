import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  KnowledgeIngestionJobEntity,
  KnowledgeJobStage,
  KnowledgeJobStatus,
  KnowledgeJobType,
} from '../entities/knowledge-ingestion-job.entity';

const JOB_STATUSES: KnowledgeJobStatus[] = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'];
const JOB_TYPES: KnowledgeJobType[] = [
  'INGEST_DOCUMENT',
  'REINDEX_DOCUMENT',
  'REINDEX_SOURCE',
  'DELETE_DOCUMENT',
];

export class UploadKnowledgeDto {
  @ApiPropertyOptional({ description: 'Overrides the document title (defaults to the filename).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Assign the uploaded document to a collection.' })
  @IsOptional()
  @IsUUID()
  collectionId?: string;
}

export class ReindexKnowledgeDto {
  @ApiPropertyOptional({ description: 'Reindex a single document by id.' })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Reindex every document under a source by id.' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

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

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: KnowledgeJobStatus;

  @ApiPropertyOptional({ enum: JOB_TYPES })
  @IsOptional()
  @IsIn(JOB_TYPES)
  type?: KnowledgeJobType;
}

export class KnowledgeIngestionJobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: JOB_TYPES }) type!: KnowledgeJobType;
  @ApiProperty({ enum: JOB_STATUSES }) status!: KnowledgeJobStatus;
  @ApiProperty({ enum: ['QUEUED', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'DONE'] })
  stage!: KnowledgeJobStage;
  @ApiPropertyOptional({ nullable: true }) documentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceId!: string | null;
  @ApiProperty() progress!: number;
  @ApiProperty() attempts!: number;
  @ApiProperty() maxAttempts!: number;
  @ApiPropertyOptional({ nullable: true }) error!: string | null;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) startedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) completedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: KnowledgeIngestionJobEntity): KnowledgeIngestionJobResponseDto {
    const dto = new KnowledgeIngestionJobResponseDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.status = entity.status;
    dto.stage = entity.stage;
    dto.documentId = entity.documentId;
    dto.sourceId = entity.sourceId;
    dto.progress = entity.progress;
    dto.attempts = entity.attempts;
    dto.maxAttempts = entity.maxAttempts;
    dto.error = entity.error;
    dto.metadata = entity.metadata;
    dto.startedAt = entity.startedAt ? entity.startedAt.toISOString() : null;
    dto.completedAt = entity.completedAt ? entity.completedAt.toISOString() : null;
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
export class PaginatedKnowledgeIngestionJobsResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeIngestionJobsDto> {}
