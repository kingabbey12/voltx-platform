import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AIMessageRole, AIProviderName } from '../models/ai-model.types';

export class AIChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant', 'tool'] })
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role!: AIMessageRole;

  @ApiProperty({ example: 'Summarize the latest conversation.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ example: 'search_files' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class AIToolResultDto {
  @ApiProperty({ example: 'search_files' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toolName!: string;

  @ApiProperty({ example: 'Found 3 matching files.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isError?: boolean;
}

export class AIChatRequestDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'google'] })
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'google'])
  provider?: AIProviderName;

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 'You are helping with a workspace incident summary.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @ApiPropertyOptional({
    example: ['Workspace: Voltx Production', 'Priority: P1'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workspaceContext?: string[];

  @ApiPropertyOptional({ type: [AIChatMessageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AIChatMessageDto)
  conversationHistory?: AIChatMessageDto[];

  @ApiProperty({ example: 'What should I do next?' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  userPrompt!: string;

  @ApiPropertyOptional({ type: [AIToolResultDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AIToolResultDto)
  toolResults?: AIToolResultDto[];

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 1, maximum: 32768 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32768)
  maxOutputTokens?: number;
}
