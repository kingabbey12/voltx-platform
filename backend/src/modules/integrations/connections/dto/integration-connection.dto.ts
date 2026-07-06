import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import {
  IntegrationConnectionEntity,
  IntegrationConnectionStatus,
} from '../../entities/integration-connection.entity';
import { IntegrationProviderKey } from '../../provider/integration-provider.types';

const PROVIDER_KEYS: IntegrationProviderKey[] = [
  'GOOGLE_GMAIL',
  'GOOGLE_CALENDAR',
  'GOOGLE_DRIVE',
  'MICROSOFT_OUTLOOK',
  'MICROSOFT_CALENDAR',
  'MICROSOFT_ONEDRIVE',
  'SLACK',
  'MICROSOFT_TEAMS',
  'GITHUB',
  'STRIPE',
  'WEBHOOK',
  'REST_API',
];

const CONNECTION_STATUSES: IntegrationConnectionStatus[] = [
  'PENDING',
  'CONNECTED',
  'ERROR',
  'DISCONNECTED',
  'REVOKED',
  'TOKEN_EXPIRED',
];

export class InitiateOAuthDto {
  @ApiProperty({ enum: PROVIDER_KEYS })
  @IsIn(PROVIDER_KEYS)
  provider!: IntegrationProviderKey;

  @ApiProperty({ example: 'Sales Team Gmail' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({ example: 'https://app.voltx.io/integrations/callback' })
  @IsString()
  redirectUri!: string;
}

export class CompleteOAuthDto {
  @ApiProperty()
  @IsString()
  connectionId!: string;

  @ApiProperty({ description: 'The authorization code returned by the provider redirect.' })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'Must match the redirectUri used in the initiate call.' })
  @IsString()
  redirectUri!: string;
}

export class CreateApiKeyConnectionDto {
  @ApiProperty({ enum: PROVIDER_KEYS })
  @IsIn(PROVIDER_KEYS)
  provider!: IntegrationProviderKey;

  @ApiProperty({ example: 'Production Stripe' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Shared secret used to verify inbound webhook signatures.' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({ example: 'acct_123' })
  @IsOptional()
  @IsString()
  externalAccountId?: string;
}

export class UpdateConnectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ReconnectDto {
  @ApiProperty({ example: 'https://app.voltx.io/integrations/callback' })
  @IsString()
  redirectUri!: string;
}

export class RegisterWebhookDto {
  @ApiPropertyOptional({
    description: 'Provide your own signing secret, or omit to have one generated.',
  })
  @IsOptional()
  @IsString()
  secret?: string;
}

export class ListConnectionsQueryDto {
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

  @ApiPropertyOptional({ enum: PROVIDER_KEYS })
  @IsOptional()
  @IsIn(PROVIDER_KEYS)
  provider?: IntegrationProviderKey;

  @ApiPropertyOptional({ enum: CONNECTION_STATUSES })
  @IsOptional()
  @IsIn(CONNECTION_STATUSES)
  status?: IntegrationConnectionStatus;
}

export class IntegrationConnectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PROVIDER_KEYS }) provider!: IntegrationProviderKey;
  @ApiProperty() displayName!: string;
  @ApiProperty() authType!: string;
  @ApiProperty({ enum: CONNECTION_STATUSES }) status!: IntegrationConnectionStatus;
  @ApiPropertyOptional() externalAccountId!: string | null;
  @ApiProperty() version!: number;
  @ApiPropertyOptional() lastHealthCheckAt!: string | null;
  @ApiProperty() lastHealthStatus!: string;
  @ApiPropertyOptional() lastSyncAt!: string | null;
  @ApiPropertyOptional() lastError!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: IntegrationConnectionEntity): IntegrationConnectionResponseDto {
    const dto = new IntegrationConnectionResponseDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.displayName = entity.displayName;
    dto.authType = entity.authType;
    dto.status = entity.status;
    dto.externalAccountId = entity.externalAccountId;
    dto.version = entity.version;
    dto.lastHealthCheckAt = entity.lastHealthCheckAt
      ? entity.lastHealthCheckAt.toISOString()
      : null;
    dto.lastHealthStatus = entity.lastHealthStatus;
    dto.lastSyncAt = entity.lastSyncAt ? entity.lastSyncAt.toISOString() : null;
    dto.lastError = entity.lastError;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedIntegrationConnectionsDto {
  @ApiProperty({ type: [IntegrationConnectionResponseDto] })
  items!: IntegrationConnectionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class InitiateOAuthResponseDto {
  @ApiProperty() connectionId!: string;
  @ApiProperty() authorizationUrl!: string;
}

export class RegisterWebhookResponseDto {
  @ApiProperty() webhookUrl!: string;
  @ApiProperty() secret!: string;
}

export class IntegrationHealthResponseDto {
  @ApiProperty() healthy!: boolean;
  @ApiProperty() latencyMs!: number;
  @ApiPropertyOptional() message?: string;
}

export class IntegrationSyncResultResponseDto {
  @ApiProperty() itemsProcessed!: number;
  @ApiProperty() itemsFailed!: number;
  @ApiProperty() status!: string;
}

export class IntegrationConnectionSuccessResponseDto extends ApiSuccessResponseDto<IntegrationConnectionResponseDto> {}
export class PaginatedIntegrationConnectionsResponseDto extends ApiSuccessResponseDto<PaginatedIntegrationConnectionsDto> {}
export class InitiateOAuthSuccessResponseDto extends ApiSuccessResponseDto<InitiateOAuthResponseDto> {}
export class RegisterWebhookSuccessResponseDto extends ApiSuccessResponseDto<RegisterWebhookResponseDto> {}
export class IntegrationHealthSuccessResponseDto extends ApiSuccessResponseDto<IntegrationHealthResponseDto> {}
export class IntegrationSyncResultSuccessResponseDto extends ApiSuccessResponseDto<IntegrationSyncResultResponseDto> {}
