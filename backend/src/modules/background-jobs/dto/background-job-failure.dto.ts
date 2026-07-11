import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { BackgroundJobFailureEntity } from '../entities/background-job-failure.entity';

export class ListBackgroundJobFailuresQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class BackgroundJobFailureResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440010', nullable: true })
  organizationId!: string | null;

  @ApiProperty({ example: 'attachment-process' })
  queueName!: string;

  @ApiProperty({ example: 'process' })
  jobName!: string;

  @ApiPropertyOptional({ nullable: true })
  jobId!: string | null;

  @ApiProperty({ example: { attachmentId: '...' } })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: 'Timed out after 3 attempts' })
  failureReason!: string;

  @ApiProperty({ example: 3 })
  attemptsMade!: number;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt!: string;

  static fromEntity(entity: BackgroundJobFailureEntity): BackgroundJobFailureResponseDto {
    const dto = new BackgroundJobFailureResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.queueName = entity.queueName;
    dto.jobName = entity.jobName;
    dto.jobId = entity.jobId;
    dto.payload = entity.payload;
    dto.failureReason = entity.failureReason;
    dto.attemptsMade = entity.attemptsMade;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedBackgroundJobFailuresDto {
  @ApiProperty({ type: [BackgroundJobFailureResponseDto] })
  items!: BackgroundJobFailureResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class BackgroundJobFailuresSuccessResponseDto extends ApiSuccessResponseDto<PaginatedBackgroundJobFailuresDto> {}
