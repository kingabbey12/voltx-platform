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
  KnowledgeDocumentEntity,
  KnowledgeDocumentStatus,
} from '../entities/knowledge-document.entity';

const KNOWLEDGE_DOCUMENT_STATUSES: KnowledgeDocumentStatus[] = [
  'PENDING',
  'INDEXING',
  'INDEXED',
  'FAILED',
];

const KNOWLEDGE_CONTENT_TYPES = [
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'markdown',
  'text',
  'txt',
  'html',
  'structured',
];

export class IngestKnowledgeDocumentDto {
  @ApiPropertyOptional({
    example: 'sf-opp-00123',
    description: 'Upstream record id, for re-ingestion in place',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiProperty({ example: 'Acme Corp - Expansion Deal' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty({ enum: KNOWLEDGE_CONTENT_TYPES })
  @IsIn(KNOWLEDGE_CONTENT_TYPES)
  contentType!: string;

  @ApiPropertyOptional({
    description: 'Already-extracted text — required for markdown/text/structured content types.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  text?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded file bytes — required for pdf/docx/xlsx/csv content types.',
  })
  @IsOptional()
  @IsString()
  fileBase64?: string;

  @ApiPropertyOptional({ example: { dealStage: 'negotiation' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListKnowledgeDocumentsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ enum: KNOWLEDGE_DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_DOCUMENT_STATUSES)
  status?: KnowledgeDocumentStatus;
}

export class KnowledgeDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sourceId!: string;

  @ApiPropertyOptional()
  externalId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  metadata!: Record<string, unknown>;

  @ApiProperty({ enum: KNOWLEDGE_DOCUMENT_STATUSES })
  status!: KnowledgeDocumentStatus;

  @ApiPropertyOptional()
  indexedAt!: string | null;

  @ApiPropertyOptional()
  error!: string | null;

  @ApiProperty()
  createdAt!: string;

  static fromEntity(entity: KnowledgeDocumentEntity): KnowledgeDocumentResponseDto {
    const dto = new KnowledgeDocumentResponseDto();
    dto.id = entity.id;
    dto.sourceId = entity.sourceId;
    dto.externalId = entity.externalId;
    dto.title = entity.title;
    dto.contentType = entity.contentType;
    dto.metadata = entity.metadata;
    dto.status = entity.status;
    dto.indexedAt = entity.indexedAt ? entity.indexedAt.toISOString() : null;
    dto.error = entity.error;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class KnowledgeIngestionResultDto {
  @ApiProperty()
  documentId!: string;

  @ApiProperty({ enum: ['INDEXED', 'FAILED'] })
  status!: 'INDEXED' | 'FAILED';

  @ApiProperty()
  chunkCount!: number;

  @ApiPropertyOptional()
  error?: string;
}

export class PaginatedKnowledgeDocumentsDto {
  @ApiProperty({ type: [KnowledgeDocumentResponseDto] })
  items!: KnowledgeDocumentResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class KnowledgeDocumentSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeDocumentResponseDto> {}
export class KnowledgeIngestionResultSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeIngestionResultDto> {}
export class KnowledgeIngestionResultsSuccessResponseDto extends ApiSuccessResponseDto<
  KnowledgeIngestionResultDto[]
> {}
export class PaginatedKnowledgeDocumentsResponseDto extends ApiSuccessResponseDto<PaginatedKnowledgeDocumentsDto> {}
