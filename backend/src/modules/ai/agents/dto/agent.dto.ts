import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { MessageResponseDto } from '../../conversations/dto/conversation.dto';
import { AIProviderName } from '../../models/ai-model.types';
import { AgentEntity } from '../entities/agent.entity';
import { AgentRunEntity, AgentRunStatus } from '../entities/agent-run.entity';

export class CreateAgentDto {
  @ApiProperty({ example: 'Procurement Assistant' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Helps draft vendor outreach and summarize procurement needs.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @ApiProperty({
    example: 'You are a procurement assistant focused on concise vendor communications.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  systemPrompt!: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'google'] })
  @IsOptional()
  @IsString()
  provider?: AIProviderName;

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({
    example: { toolNames: ['calculator', 'http_get'], temperature: 0.2, maxOutputTokens: 2048 },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAgentDto {
  @ApiPropertyOptional({ example: 'Procurement Assistant' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Updated system prompt.' })
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

  @ApiPropertyOptional({
    example: { toolNames: ['calculator', 'http_get'], temperature: 0.2, maxOutputTokens: 2048 },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AgentToolRequestDto {
  @ApiProperty({ example: 'http_get' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toolName!: string;

  @ApiProperty({ example: { url: 'https://example.com' } })
  @IsObject()
  input!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 10000, minimum: 1, maximum: 60000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60000)
  timeoutMs?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  retries?: number;
}

export class RunAgentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ example: 'Prepare an executive update on current deployment risks.' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  prompt!: string;

  @ApiPropertyOptional({ type: [String], example: ['Region: us-east-1', 'Audience: CTO'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workspaceContext?: string[];

  @ApiPropertyOptional({ type: [AgentToolRequestDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AgentToolRequestDto)
  toolRequests?: AgentToolRequestDto[];

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 1, maximum: 32768 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(32768)
  maxOutputTokens?: number;
}

export class AgentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id!: string;

  @ApiProperty({ example: 'Executive Assistant' })
  name!: string;

  @ApiProperty({ example: 'Delivers concise executive-ready summaries and recommendations.' })
  description!: string;

  @ApiProperty({ example: 'You are an executive assistant for Voltx leadership.' })
  systemPrompt!: string;

  @ApiProperty({ example: 'openai' })
  provider!: AIProviderName;

  @ApiProperty({ example: 'gpt-5-mini' })
  model!: string;

  @ApiProperty({ example: { kind: 'system', toolNames: ['calculator', 'http_get'] } })
  configuration!: Record<string, unknown>;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:05:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: AgentEntity): AgentResponseDto {
    const dto = new AgentResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.systemPrompt = entity.systemPrompt;
    dto.provider = entity.provider;
    dto.model = entity.model;
    dto.configuration = entity.configuration;
    dto.enabled = entity.enabled;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class AgentRunResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440011' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  agentId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  conversationId!: string;

  @ApiProperty({ enum: ['RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT'] })
  status!: AgentRunStatus;

  @ApiProperty({ example: { prompt: 'Prepare an update.' } })
  input!: Record<string, unknown>;

  @ApiProperty({ example: { outputText: 'Here is the update.' } })
  output!: Record<string, unknown>;

  @ApiProperty({ example: { inputTokens: 120, outputTokens: 80, totalTokens: 200 } })
  tokenUsage!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  startedAt!: string;

  @ApiPropertyOptional({ example: '2026-07-04T00:00:05.000Z' })
  completedAt!: string | null;

  @ApiPropertyOptional({ example: 5000 })
  durationMs!: number | null;

  @ApiPropertyOptional({ example: null })
  error!: string | null;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  static fromEntity(entity: AgentRunEntity): AgentRunResponseDto {
    const dto = new AgentRunResponseDto();
    dto.id = entity.id;
    dto.agentId = entity.agentId;
    dto.conversationId = entity.conversationId;
    dto.status = entity.status;
    dto.input = entity.input;
    dto.output = entity.output;
    dto.tokenUsage = entity.tokenUsage;
    dto.startedAt = entity.startedAt.toISOString();
    dto.completedAt = entity.completedAt ? entity.completedAt.toISOString() : null;
    dto.durationMs = entity.durationMs;
    dto.error = entity.error;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class RunAgentResponseDto {
  @ApiProperty({ type: AgentRunResponseDto })
  run!: AgentRunResponseDto;

  @ApiProperty({ type: MessageResponseDto })
  userMessage!: MessageResponseDto;

  @ApiProperty({ type: [MessageResponseDto] })
  toolMessages!: MessageResponseDto[];

  @ApiProperty({ type: MessageResponseDto, nullable: true })
  assistantMessage!: MessageResponseDto | null;
}

export class AgentSuccessResponseDto extends ApiSuccessResponseDto<AgentResponseDto> {}
export class AgentsSuccessResponseDto extends ApiSuccessResponseDto<AgentResponseDto[]> {}
export class AgentRunSuccessResponseDto extends ApiSuccessResponseDto<RunAgentResponseDto> {}
