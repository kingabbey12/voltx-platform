import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AI_PROVIDER_NAMES, AIProviderName } from '../../models/ai-model.types';
import {
  PromptEntity,
  PromptStatus,
  PromptTestRunEntity,
  PromptVersionEntity,
} from '../entities/prompt.entity';

/** Statuses a PATCH may move a prompt to — the review flow only. PUBLISHED and
 * ARCHIVED are reached through their dedicated endpoints. */
export const PROMPT_REVIEW_STATUSES: PromptStatus[] = ['DRAFT', 'REVIEW', 'APPROVED'];

/** The runtime lookup key: a stable, url-safe identifier scoped per org. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export class CreatePromptDto {
  @ApiProperty({
    description: 'Stable, org-unique key the AI Gateway resolves at runtime.',
    example: 'sales.followup_email',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(KEY_PATTERN, {
    message: 'key must be lowercase alphanumeric with . _ - separators',
  })
  key!: string;

  @ApiProperty({ example: 'Sales follow-up email' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Drafts a follow-up email after a sales call.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'sales' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ type: [String], example: ['sales', 'email'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  @ApiProperty({
    description: 'The prompt template. Reference variables as {{name}}.',
    example: 'Write a follow-up email to {{customer_name}} at {{company_name}} on {{today}}.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  template!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Declared custom variable names (built-ins need not be declared).',
    example: ['customer_name', 'company_name'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  variables?: string[];

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ enum: AI_PROVIDER_NAMES, example: 'openai' })
  @IsOptional()
  @IsIn(AI_PROVIDER_NAMES)
  provider?: AIProviderName;

  @ApiPropertyOptional({ description: 'Free-text note stored on the initial version.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePromptDto {
  @ApiPropertyOptional({ example: 'Sales follow-up email' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    enum: PROMPT_REVIEW_STATUSES,
    description: 'Advance the review workflow (DRAFT ↔ REVIEW ↔ APPROVED).',
  })
  @IsOptional()
  @IsIn(PROMPT_REVIEW_STATUSES)
  status?: PromptStatus;

  @ApiPropertyOptional({
    description: 'New template body. Providing this creates a new immutable version.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  template?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  variables?: string[];

  @ApiPropertyOptional({ example: 'gpt-5-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ enum: AI_PROVIDER_NAMES })
  @IsOptional()
  @IsIn(AI_PROVIDER_NAMES)
  provider?: AIProviderName;

  @ApiPropertyOptional({ description: 'Note stored on the new version, when one is created.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ListPromptsQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
  status?: PromptStatus;

  @ApiPropertyOptional({ example: 'sales' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PublishPromptDto {
  @ApiPropertyOptional({
    description: 'Version to publish. Defaults to the latest version.',
  })
  @IsOptional()
  @IsString()
  versionId?: string;
}

export class RollbackPromptDto {
  @ApiProperty({ description: 'The historical version to restore as a new version.' })
  @IsString()
  @MinLength(1)
  versionId!: string;
}

export class TestPromptDto {
  @ApiPropertyOptional({
    type: Object,
    description: 'Values for the template variables, e.g. { "customer_name": "Acme" }.',
    example: { customer_name: 'Ada Lovelace', company_name: 'Analytical Engines' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'Optional sample user message. When present the rendered prompt is sent as the system ' +
      'prompt and this as the user turn; otherwise the rendered prompt is sent as the user turn.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  input?: string;

  @ApiPropertyOptional({ description: 'Version to test. Defaults to published, else latest.' })
  @IsOptional()
  @IsString()
  versionId?: string;

  @ApiPropertyOptional({ example: 'gpt-5-mini', description: 'Override the model for this run.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ enum: AI_PROVIDER_NAMES, description: 'Override the provider.' })
  @IsOptional()
  @IsIn(AI_PROVIDER_NAMES)
  provider?: AIProviderName;

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 32_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32_000)
  maxOutputTokens?: number;
}

export class PromptVersionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() promptId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() template!: string;
  @ApiProperty({ type: [String] }) variables!: string[];
  @ApiPropertyOptional({ nullable: true }) model!: string | null;
  @ApiPropertyOptional({ nullable: true }) provider!: string | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) createdByUserId!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: PromptVersionEntity): PromptVersionResponseDto {
    const dto = new PromptVersionResponseDto();
    dto.id = entity.id;
    dto.promptId = entity.promptId;
    dto.version = entity.version;
    dto.template = entity.template;
    dto.variables = entity.variables;
    dto.model = entity.model;
    dto.provider = entity.provider;
    dto.notes = entity.notes;
    dto.createdByUserId = entity.createdByUserId;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PromptResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'sales.followup_email' }) key!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) category!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ enum: ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] })
  status!: PromptStatus;
  @ApiPropertyOptional({ nullable: true }) publishedVersionId!: string | null;
  @ApiPropertyOptional({ type: PromptVersionResponseDto, nullable: true })
  latestVersion!: PromptVersionResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) createdByUserId!: string | null;
  @ApiPropertyOptional({ nullable: true }) updatedByUserId!: string | null;
  @ApiPropertyOptional({ nullable: true }) archivedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(
    entity: PromptEntity,
    latestVersion?: PromptVersionEntity | null,
  ): PromptResponseDto {
    const dto = new PromptResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.category = entity.category;
    dto.tags = entity.tags;
    dto.status = entity.status;
    dto.publishedVersionId = entity.publishedVersionId;
    dto.latestVersion = latestVersion ? PromptVersionResponseDto.fromEntity(latestVersion) : null;
    dto.createdByUserId = entity.createdByUserId;
    dto.updatedByUserId = entity.updatedByUserId;
    dto.archivedAt = entity.archivedAt ? entity.archivedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedPromptsDto {
  @ApiProperty({ type: [PromptResponseDto] }) items!: PromptResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class PromptTestResultDto {
  @ApiProperty({ description: 'The fully rendered prompt sent to the model.' })
  renderedPrompt!: string;
  @ApiPropertyOptional({ nullable: true }) provider!: string | null;
  @ApiPropertyOptional({ nullable: true }) model!: string | null;
  @ApiPropertyOptional({ nullable: true }) finishReason!: string | null;
  @ApiProperty({ description: 'End-to-end latency of the model call, in milliseconds.' })
  latencyMs!: number;
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty({ description: 'Estimated cost of the run, in USD.' })
  costUsd!: number;
  @ApiProperty({ description: 'The model response text.' })
  response!: string;

  static fromEntity(entity: PromptTestRunEntity, response: string): PromptTestResultDto {
    const dto = new PromptTestResultDto();
    dto.renderedPrompt = entity.renderedPrompt;
    dto.provider = entity.provider;
    dto.model = entity.model;
    dto.finishReason = null;
    dto.latencyMs = entity.latencyMs ?? 0;
    dto.inputTokens = entity.inputTokens ?? 0;
    dto.outputTokens = entity.outputTokens ?? 0;
    dto.totalTokens = entity.totalTokens ?? 0;
    dto.costUsd = entity.costUsd ?? 0;
    dto.response = response;
    return dto;
  }
}
