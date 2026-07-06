import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { KnowledgeSearchResult } from '../retrieval/knowledge-retrieval.types';

export class SearchKnowledgeDto {
  @ApiProperty({ example: 'What is the status of the Acme Corp expansion deal?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query!: string;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  sourceIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  sourceTypes?: string[];
}

export class KnowledgeCitationDto {
  @ApiProperty() sourceId!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() sourceName!: string;
  @ApiProperty() documentId!: string;
  @ApiProperty() documentTitle!: string;
  @ApiPropertyOptional() externalId!: string | null;
}

export class KnowledgeSearchResultDto {
  @ApiProperty() chunkId!: string;
  @ApiProperty() content!: string;
  @ApiProperty() confidence!: number;
  @ApiPropertyOptional() semanticScore!: number | null;
  @ApiPropertyOptional() keywordScore!: number | null;
  @ApiProperty({ type: KnowledgeCitationDto }) citation!: KnowledgeCitationDto;

  static fromResult(result: KnowledgeSearchResult): KnowledgeSearchResultDto {
    const dto = new KnowledgeSearchResultDto();
    dto.chunkId = result.chunkId;
    dto.content = result.content;
    dto.confidence = result.confidence;
    dto.semanticScore = result.semanticScore;
    dto.keywordScore = result.keywordScore;
    dto.citation = result.citation;
    return dto;
  }
}

export class KnowledgeContextPreviewDto {
  @ApiProperty({ type: [String] })
  contextStrings!: string[];

  @ApiProperty({ type: [KnowledgeCitationDto] })
  citations!: KnowledgeCitationDto[];

  @ApiProperty()
  confidence!: number;
}

export class KnowledgeSearchResultsSuccessResponseDto extends ApiSuccessResponseDto<
  KnowledgeSearchResultDto[]
> {}
export class KnowledgeContextPreviewSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeContextPreviewDto> {}
