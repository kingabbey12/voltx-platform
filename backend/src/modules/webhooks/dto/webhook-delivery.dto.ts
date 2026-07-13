import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookDeliveryStatus } from '@prisma/client';
import { WebhookDeliveryEntity } from '../entities/webhook-delivery.entity';

export class WebhookDeliveryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventType!: string;
  @ApiProperty({ type: Object }) payload!: unknown;
  @ApiProperty({ enum: WebhookDeliveryStatus }) status!: WebhookDeliveryStatus;
  @ApiPropertyOptional({ nullable: true }) responseStatusCode!: number | null;
  @ApiPropertyOptional({ nullable: true }) responseBody!: string | null;
  @ApiProperty() attemptCount!: number;
  @ApiPropertyOptional({ nullable: true }) deliveredAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WebhookDeliveryEntity): WebhookDeliveryResponseDto {
    const dto = new WebhookDeliveryResponseDto();
    dto.id = entity.id;
    dto.eventType = entity.eventType;
    dto.payload = entity.payload;
    dto.status = entity.status;
    dto.responseStatusCode = entity.responseStatusCode;
    dto.responseBody = entity.responseBody;
    dto.attemptCount = entity.attemptCount;
    dto.deliveredAt = entity.deliveredAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
