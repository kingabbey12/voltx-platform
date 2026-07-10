import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { CommsChannelConnectionEntity } from '../entities/channel-connection.entity';

const CHANNEL_KEYS = [
  'GMAIL',
  'OUTLOOK',
  'WHATSAPP',
  'TWILIO_VOICE',
  'TWILIO_SMS',
  'SLACK',
  'TEAMS',
] as const;

const API_KEY_CHANNEL_KEYS = ['WHATSAPP', 'TWILIO_VOICE', 'TWILIO_SMS'] as const;

export class InitiateChannelOAuthDto {
  @ApiProperty({ enum: CHANNEL_KEYS })
  @IsIn(CHANNEL_KEYS)
  channel!: string;

  @ApiProperty({ example: 'Sales Gmail' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({ example: 'https://app.usevoltx.com/settings/communications/callback' })
  @IsString()
  redirectUri!: string;
}

export class CompleteChannelOAuthDto {
  @ApiProperty()
  @IsString()
  connectionId!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  redirectUri!: string;
}

export class CreateApiKeyChannelConnectionDto {
  @ApiProperty({ enum: API_KEY_CHANNEL_KEYS })
  @IsIn(API_KEY_CHANNEL_KEYS)
  channel!: string;

  @ApiProperty({ example: 'Support WhatsApp' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({
    description:
      'WhatsApp Cloud API permanent access token, or Twilio Auth Token — the secret credential value.',
  })
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @ApiPropertyOptional({ example: '+15551234567', description: 'The connected phone number' })
  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @ApiPropertyOptional({
    description:
      'Additional non-secret identifiers the channel needs, e.g. {"phoneNumberId": "...", "businessAccountId": "..."} for WhatsApp, or {"accountSid": "AC..."} for Twilio.',
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, string>;
}

export class SubscribeTeamsChannelDto {
  @ApiProperty({ description: 'Microsoft Teams team id' })
  @IsString()
  @MinLength(1)
  teamId!: string;

  @ApiProperty({ description: 'Channel id within the team' })
  @IsString()
  @MinLength(1)
  channelId!: string;
}

export class ListChannelConnectionsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: CHANNEL_KEYS })
  @IsOptional()
  @IsIn(CHANNEL_KEYS)
  channel?: string;
}

export class ChannelConnectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() channel!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) externalAccountId!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastSyncAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastError!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: CommsChannelConnectionEntity): ChannelConnectionResponseDto {
    const dto = new ChannelConnectionResponseDto();
    dto.id = entity.id;
    dto.channel = entity.channel;
    dto.displayName = entity.displayName;
    dto.status = entity.status;
    dto.externalAccountId = entity.externalAccountId;
    dto.lastSyncAt = entity.lastSyncAt ? entity.lastSyncAt.toISOString() : null;
    dto.lastError = entity.lastError;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedChannelConnectionsResponseDto {
  @ApiProperty({ type: [ChannelConnectionResponseDto] }) items!: ChannelConnectionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class InitiateChannelOAuthResponseDto {
  @ApiProperty() connectionId!: string;
  @ApiProperty() authorizationUrl!: string;
}

export class ChannelConnectionSuccessResponseDto extends ApiSuccessResponseDto<ChannelConnectionResponseDto> {}
export class PaginatedChannelConnectionsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedChannelConnectionsResponseDto> {}
export class InitiateChannelOAuthSuccessResponseDto extends ApiSuccessResponseDto<InitiateChannelOAuthResponseDto> {}
