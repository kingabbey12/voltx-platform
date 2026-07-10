import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { NotificationEntity } from '../entities/notification.entity';

const CATEGORY_KEYS = [
  'MESSAGE',
  'CALL',
  'MEETING',
  'CRM',
  'WORKFLOW',
  'AI',
  'SECURITY',
  'BILLING',
] as const;

export class ListNotificationsQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() read?: boolean;
  @ApiPropertyOptional({ enum: CATEGORY_KEYS })
  @IsOptional()
  @IsIn(CATEGORY_KEYS)
  category?: string;
}

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() category!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) body!: string | null;
  @ApiPropertyOptional({ nullable: true }) actionUrl!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, unknown>;
  @ApiProperty() read!: boolean;
  @ApiPropertyOptional({ nullable: true }) readAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: NotificationEntity): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = entity.id;
    dto.category = entity.category;
    dto.title = entity.title;
    dto.body = entity.body;
    dto.actionUrl = entity.actionUrl;
    dto.metadata = entity.metadata;
    dto.read = entity.read;
    dto.readAt = entity.readAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedNotificationsDto {
  @ApiProperty({ type: [NotificationResponseDto] }) items!: NotificationResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty() count!: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty() count!: number;
}

export class NotificationPreferencesDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' } })
  preferences!: Record<string, boolean>;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' } })
  preferences!: Record<string, boolean>;
}

export class NotificationSuccessResponseDto extends ApiSuccessResponseDto<NotificationResponseDto> {}
export class PaginatedNotificationsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedNotificationsDto> {}
export class UnreadCountSuccessResponseDto extends ApiSuccessResponseDto<UnreadCountResponseDto> {}
export class MarkAllReadSuccessResponseDto extends ApiSuccessResponseDto<MarkAllReadResponseDto> {}
export class NotificationPreferencesSuccessResponseDto extends ApiSuccessResponseDto<NotificationPreferencesDto> {}
