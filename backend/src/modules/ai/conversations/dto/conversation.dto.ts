import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { AIMessageRole, AIProviderName } from '../../models/ai-model.types';
import { ConversationEntity } from '../entities/conversation.entity';
import { MessageEntity } from '../entities/message.entity';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Quarterly planning review' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'google'] })
  @IsOptional()
  @IsString()
  provider?: AIProviderName;

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 'Incident retrospective' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'planning', description: 'Filter by title or message content' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class MessageToolResultDto {
  @ApiProperty({ example: 'workspace_search' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toolName!: string;

  @ApiProperty({ example: 'Matched 4 deployment runbooks.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isError?: boolean;
}

export class CreateMessageDto {
  @ApiProperty({ example: 'Summarize the current workspace risk posture.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ example: 'Focus on executive-level summary.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @ApiPropertyOptional({ type: [String], example: ['Workspace: Voltx', 'Priority: High'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workspaceContext?: string[];

  @ApiPropertyOptional({ type: [MessageToolResultDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MessageToolResultDto)
  toolResults?: MessageToolResultDto[];

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

export class ConversationResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Quarterly planning review' })
  title!: string;

  @ApiProperty({ example: 'gpt-5-mini' })
  model!: string;

  @ApiProperty({ example: 'openai' })
  provider!: string;

  @ApiProperty({ example: false })
  pinned!: boolean;

  @ApiProperty({ example: false })
  archived!: boolean;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: ConversationEntity): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = entity.id;
    dto.title = entity.title;
    dto.model = entity.model;
    dto.provider = entity.provider;
    dto.pinned = entity.pinned;
    dto.archived = entity.archived;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class MessageResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  conversationId!: string;

  @ApiProperty({ enum: ['system', 'user', 'assistant', 'tool'] })
  role!: AIMessageRole;

  @ApiProperty({ example: 'Current workspace risk is elevated because...' })
  content!: string;

  @ApiPropertyOptional({ example: { provider: 'openai', model: 'gpt-5-mini' } })
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ example: { inputTokens: 42, outputTokens: 87, totalTokens: 129 } })
  tokenUsage!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  static fromEntity(entity: MessageEntity): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.role = entity.role;
    dto.content = entity.content;
    dto.metadata = entity.metadata;
    dto.tokenUsage = entity.tokenUsage;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedConversationsDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  items!: ConversationResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedMessagesDto {
  @ApiProperty({ type: [MessageResponseDto] })
  items!: MessageResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class CreateConversationMessageResponseDto {
  @ApiProperty({ type: MessageResponseDto })
  userMessage!: MessageResponseDto;

  @ApiProperty({ type: [MessageResponseDto] })
  toolMessages!: MessageResponseDto[];

  @ApiProperty({ type: MessageResponseDto, nullable: true })
  assistantMessage!: MessageResponseDto | null;
}

export class ConversationSuccessResponseDto extends ApiSuccessResponseDto<ConversationResponseDto> {}

export class PaginatedConversationsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedConversationsDto> {}

export class MessageSuccessResponseDto extends ApiSuccessResponseDto<MessageResponseDto> {}

export class PaginatedMessagesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedMessagesDto> {}

export class CreateConversationMessageSuccessResponseDto extends ApiSuccessResponseDto<CreateConversationMessageResponseDto> {}
