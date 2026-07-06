import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import {
  IntegrationEventEntity,
  IntegrationSyncRunEntity,
} from '../../entities/integration-support.entity';
import { IntegrationMetrics } from '../../observability/integration-stats.service';

export class ListPageQueryDto {
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
}

export class IntegrationEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() connectionId!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional() externalId!: string | null;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiPropertyOptional() processedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: IntegrationEventEntity): IntegrationEventResponseDto {
    const dto = new IntegrationEventResponseDto();
    dto.id = entity.id;
    dto.connectionId = entity.connectionId;
    dto.type = entity.type;
    dto.externalId = entity.externalId;
    dto.payload = entity.payload;
    dto.processedAt = entity.processedAt ? entity.processedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class IntegrationSyncRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() connectionId!: string;
  @ApiProperty() trigger!: string;
  @ApiProperty() status!: string;
  @ApiProperty() startedAt!: string;
  @ApiPropertyOptional() completedAt!: string | null;
  @ApiPropertyOptional() durationMs!: number | null;
  @ApiProperty() itemsProcessed!: number;
  @ApiProperty() itemsFailed!: number;
  @ApiPropertyOptional() error!: string | null;

  static fromEntity(entity: IntegrationSyncRunEntity): IntegrationSyncRunResponseDto {
    const dto = new IntegrationSyncRunResponseDto();
    dto.id = entity.id;
    dto.connectionId = entity.connectionId;
    dto.trigger = entity.trigger;
    dto.status = entity.status;
    dto.startedAt = entity.startedAt.toISOString();
    dto.completedAt = entity.completedAt ? entity.completedAt.toISOString() : null;
    dto.durationMs = entity.durationMs;
    dto.itemsProcessed = entity.itemsProcessed;
    dto.itemsFailed = entity.itemsFailed;
    dto.error = entity.error;
    return dto;
  }
}

export class IntegrationMetricsDto {
  @ApiProperty() totalCalls!: number;
  @ApiProperty() failedCalls!: number;
  @ApiProperty() totalRetries!: number;
  @ApiProperty() averageDurationMs!: number;
  @ApiPropertyOptional() minRateLimitRemaining!: number | null;
  @ApiProperty() totalSyncRuns!: number;
  @ApiProperty() failedSyncRuns!: number;
  @ApiProperty() totalEvents!: number;
  @ApiProperty() lastHealthStatus!: string;
  @ApiPropertyOptional() lastHealthCheckAt!: string | null;

  static fromMetrics(metrics: IntegrationMetrics): IntegrationMetricsDto {
    return Object.assign(new IntegrationMetricsDto(), metrics);
  }
}

export class IntegrationApiUsageLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiPropertyOptional() statusCode!: number | null;
  @ApiProperty() durationMs!: number;
  @ApiPropertyOptional() rateLimitRemaining!: number | null;
  @ApiProperty() retryCount!: number;
  @ApiPropertyOptional() error!: string | null;
  @ApiProperty() createdAt!: string;
}

export class PaginatedIntegrationEventsDto {
  @ApiProperty({ type: [IntegrationEventResponseDto] }) items!: IntegrationEventResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class PaginatedIntegrationApiUsageLogsDto {
  @ApiProperty({ type: [IntegrationApiUsageLogResponseDto] })
  items!: IntegrationApiUsageLogResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class PaginatedIntegrationSyncRunsDto {
  @ApiProperty({ type: [IntegrationSyncRunResponseDto] }) items!: IntegrationSyncRunResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class PaginatedIntegrationEventsResponseDto extends ApiSuccessResponseDto<PaginatedIntegrationEventsDto> {}
export class PaginatedIntegrationSyncRunsResponseDto extends ApiSuccessResponseDto<PaginatedIntegrationSyncRunsDto> {}
export class PaginatedIntegrationApiUsageLogsResponseDto extends ApiSuccessResponseDto<PaginatedIntegrationApiUsageLogsDto> {}
export class IntegrationMetricsSuccessResponseDto extends ApiSuccessResponseDto<IntegrationMetricsDto> {}
