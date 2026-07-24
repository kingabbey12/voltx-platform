import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
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
import { AIProviderName } from '../../models/ai-model.types';
import { AgentVersionEntity } from '../entities/agent-version.entity';

export class CreateAgentVersionDto {
  @ApiPropertyOptional({ example: 'Procurement Assistant' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Helps draft vendor outreach.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'You are a procurement assistant.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  systemPrompt?: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'google'] })
  @IsOptional()
  @IsString()
  provider?: AIProviderName;

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 1, maximum: 32768 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32768)
  maxTokens?: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440030' })
  @IsOptional()
  @IsUUID()
  promptId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440040' })
  @IsOptional()
  @IsUUID()
  knowledgeCollectionId?: string;

  @ApiPropertyOptional({ example: { canDelegate: true } })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String], example: ['calculator', 'http_get'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  toolNames?: string[];
}

export class PublishAgentVersionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440020',
    description: 'Defaults to the latest version when omitted.',
  })
  @IsOptional()
  @IsUUID()
  versionId?: string;
}

export class RollbackAgentVersionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  @IsUUID()
  versionId!: string;
}

export class AgentVersionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  agentId!: string;

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ example: 'Procurement Assistant' })
  name!: string;

  @ApiProperty({ example: 'Helps draft vendor outreach.' })
  description!: string;

  @ApiProperty({ example: 'You are a procurement assistant.' })
  systemPrompt!: string;

  @ApiProperty({ example: 'openai' })
  provider!: AIProviderName;

  @ApiProperty({ example: 'gpt-5-mini' })
  model!: string;

  @ApiPropertyOptional({ example: 0.2 })
  temperature!: number | null;

  @ApiPropertyOptional({ example: 2048 })
  maxTokens!: number | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440030' })
  promptId!: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440040' })
  knowledgeCollectionId!: string | null;

  @ApiProperty({ example: {} })
  configuration!: Record<string, unknown>;

  @ApiProperty({ type: [String], example: ['calculator', 'http_get'] })
  toolNames!: string[];

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440050' })
  createdByUserId!: string | null;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  static fromEntity(entity: AgentVersionEntity, toolNames: string[]): AgentVersionResponseDto {
    const dto = new AgentVersionResponseDto();
    dto.id = entity.id;
    dto.agentId = entity.agentId;
    dto.version = entity.version;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.systemPrompt = entity.systemPrompt;
    dto.provider = entity.provider;
    dto.model = entity.model;
    dto.temperature = entity.temperature;
    dto.maxTokens = entity.maxTokens;
    dto.promptId = entity.promptId;
    dto.knowledgeCollectionId = entity.knowledgeCollectionId;
    dto.configuration = entity.configuration;
    dto.toolNames = toolNames;
    dto.createdByUserId = entity.createdByUserId;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class AgentVersionSuccessResponseDto extends ApiSuccessResponseDto<AgentVersionResponseDto> {}
export class AgentVersionsSuccessResponseDto extends ApiSuccessResponseDto<
  AgentVersionResponseDto[]
> {}
