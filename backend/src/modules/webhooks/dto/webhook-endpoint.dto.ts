import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEndpointStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { WebhookEndpointEntity } from '../entities/webhook-endpoint.entity';

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: 'https://acme.example/webhooks/voltx' })
  @IsUrl({ require_protocol: true })
  url!: string;

  @ApiPropertyOptional({ example: 'Production event sync' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: ['sales.lead.created', 'workflow.run.completed'],
    description: 'Event type keys from the webhook event catalog',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eventTypes!: string[];
}

export class UpdateWebhookEndpointDto {
  @ApiPropertyOptional({ example: 'https://acme.example/webhooks/voltx' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ example: 'Production event sync' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: ['sales.lead.created'],
    description: 'Replaces the full set of subscribed event types',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eventTypes?: string[];
}

export class WebhookEndpointResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ example: ['sales.lead.created'] }) eventTypes!: string[];
  @ApiProperty({ enum: WebhookEndpointStatus }) status!: WebhookEndpointStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: WebhookEndpointEntity): WebhookEndpointResponseDto {
    const dto = new WebhookEndpointResponseDto();
    dto.id = entity.id;
    dto.url = entity.url;
    dto.description = entity.description;
    dto.eventTypes = entity.eventTypes;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class CreateWebhookEndpointResponseDto extends WebhookEndpointResponseDto {
  @ApiProperty({
    example: 'whsec_ab12cd34ef56...',
    description: 'The signing secret — shown exactly once, never retrievable again',
  })
  secret!: string;
}

export class RotateWebhookEndpointSecretResponseDto {
  @ApiProperty({
    example: 'whsec_gh78ij90kl12...',
    description: 'The new signing secret — shown exactly once, never retrievable again',
  })
  secret!: string;
}

export class WebhookEventCatalogEntryDto {
  @ApiProperty({ example: 'sales.lead.created' }) key!: string;
  @ApiProperty({ example: 'A new sales lead was created' }) description!: string;
}
