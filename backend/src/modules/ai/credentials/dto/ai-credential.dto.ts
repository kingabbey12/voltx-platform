import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AI_PROVIDER_NAMES, AIProviderName } from '../../models/ai-model.types';
import {
  AiProviderCredentialEntity,
  AiProviderCredentialStatus,
} from '../entities/ai-provider-credential.entity';

const STATUSES: AiProviderCredentialStatus[] = ['ACTIVE', 'DISABLED'];

export class CreateAiCredentialDto {
  @ApiProperty({ enum: AI_PROVIDER_NAMES, example: 'openai' })
  @IsIn(AI_PROVIDER_NAMES)
  provider!: AIProviderName;

  @ApiProperty({ description: 'The provider API key. Encrypted at rest; never returned.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  apiKey!: string;

  @ApiPropertyOptional({
    description: 'Distinguishes multiple keys for one provider. Defaults to "default".',
    example: 'production',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ description: 'Override the provider base URL (e.g. an Azure endpoint).' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Provider-specific extras, e.g. { "apiVersion": "..." }.' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateAiCredentialDto {
  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: AiProviderCredentialStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RotateAiCredentialDto {
  @ApiProperty({ description: 'The new API key. Re-encrypted at rest; never returned.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  apiKey!: string;
}

export class ListAiCredentialsQueryDto {
  @ApiPropertyOptional({ enum: AI_PROVIDER_NAMES })
  @IsOptional()
  @IsIn(AI_PROVIDER_NAMES)
  provider?: AIProviderName;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * The safe projection of a credential: the API key is masked to a short
 * preview and the ciphertext is never exposed.
 */
export class AiCredentialResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AI_PROVIDER_NAMES }) provider!: AIProviderName;
  @ApiProperty() label!: string;
  @ApiProperty({ description: 'Masked preview, e.g. "sk-…4f2a". Never the full key.' })
  maskedApiKey!: string;
  @ApiPropertyOptional({ nullable: true }) baseUrl!: string | null;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;
  @ApiProperty({ enum: STATUSES }) status!: AiProviderCredentialStatus;
  @ApiPropertyOptional({ nullable: true }) lastRotatedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastTestedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastTestStatus!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastTestError!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(
    entity: AiProviderCredentialEntity,
    maskedApiKey: string,
  ): AiCredentialResponseDto {
    const dto = new AiCredentialResponseDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.label = entity.label;
    dto.maskedApiKey = maskedApiKey;
    dto.baseUrl = entity.baseUrl;
    dto.metadata = entity.metadata;
    dto.status = entity.status;
    dto.lastRotatedAt = entity.lastRotatedAt ? entity.lastRotatedAt.toISOString() : null;
    dto.lastTestedAt = entity.lastTestedAt ? entity.lastTestedAt.toISOString() : null;
    dto.lastTestStatus = entity.lastTestStatus;
    dto.lastTestError = entity.lastTestError;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class AiCredentialTestResultDto {
  @ApiProperty({ enum: ['ok', 'failed'] }) status!: 'ok' | 'failed';
  @ApiProperty() message!: string;
  @ApiProperty() testedAt!: string;
}

export class PaginatedAiCredentialsDto {
  @ApiProperty({ type: [AiCredentialResponseDto] }) items!: AiCredentialResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
