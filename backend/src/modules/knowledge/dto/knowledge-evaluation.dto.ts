import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  KnowledgeEvaluationCase,
  KnowledgeEvaluationResult,
} from '../observability/knowledge-evaluation.service';

export class KnowledgeEvaluationCaseDto implements KnowledgeEvaluationCase {
  @ApiProperty({ description: 'User question/query used for retrieval evaluation' })
  @IsString()
  query!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedChunkIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedDocumentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedSourceIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedCitationChunkIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedCitationDocumentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  promptTokens?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  completionTokens?: number;
}

export class RunKnowledgeEvaluationDto {
  @ApiProperty({ type: [KnowledgeEvaluationCaseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeEvaluationCaseDto)
  cases!: KnowledgeEvaluationCaseDto[];
}

export class KnowledgeEvaluationResultDto implements KnowledgeEvaluationResult {
  @ApiProperty() caseCount!: number;
  @ApiProperty() precisionAt5!: number;
  @ApiProperty() recallAt10!: number;
  @ApiProperty() mrr!: number;
  @ApiProperty() ndcgAt10!: number;
  @ApiProperty() citationAccuracy!: number;
  @ApiProperty() hallucinationRate!: number;
  @ApiProperty() contextPrecision!: number;
  @ApiProperty() averageRetrievalTimeMs!: number;
  @ApiProperty() averagePromptTokens!: number;
  @ApiProperty() averageCompletionTokens!: number;

  static fromResult(result: KnowledgeEvaluationResult): KnowledgeEvaluationResultDto {
    const dto = new KnowledgeEvaluationResultDto();
    dto.caseCount = result.caseCount;
    dto.precisionAt5 = result.precisionAt5;
    dto.recallAt10 = result.recallAt10;
    dto.mrr = result.mrr;
    dto.ndcgAt10 = result.ndcgAt10;
    dto.citationAccuracy = result.citationAccuracy;
    dto.hallucinationRate = result.hallucinationRate;
    dto.contextPrecision = result.contextPrecision;
    dto.averageRetrievalTimeMs = result.averageRetrievalTimeMs;
    dto.averagePromptTokens = result.averagePromptTokens;
    dto.averageCompletionTokens = result.averageCompletionTokens;
    return dto;
  }
}

export class KnowledgeEvaluationSuccessResponseDto extends ApiSuccessResponseDto<KnowledgeEvaluationResultDto> {}
