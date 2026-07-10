import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { CommsCallEntity, CommsCallRecordingEntity } from '../entities/call.entity';

export class ListCallsQueryDto {
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
}

export class UpdateCallNotesDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  notes!: string;
}

export class CallResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) conversationId!: string | null;
  @ApiProperty() connectionId!: string;
  @ApiProperty() direction!: string;
  @ApiProperty() status!: string;
  @ApiProperty() fromNumber!: string;
  @ApiProperty() toNumber!: string;
  @ApiPropertyOptional({ nullable: true }) durationSeconds!: number | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) startedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) endedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() hasRecording!: boolean;

  static fromEntity(entity: CommsCallEntity, hasRecording: boolean): CallResponseDto {
    const dto = new CallResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.connectionId = entity.connectionId;
    dto.direction = entity.direction;
    dto.status = entity.status;
    dto.fromNumber = entity.fromNumber;
    dto.toNumber = entity.toNumber;
    dto.durationSeconds = entity.durationSeconds;
    dto.notes = entity.notes;
    dto.startedAt = entity.startedAt ? entity.startedAt.toISOString() : null;
    dto.endedAt = entity.endedAt ? entity.endedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.hasRecording = hasRecording;
    return dto;
  }
}

export class PaginatedCallsResponseDto {
  @ApiProperty({ type: [CallResponseDto] }) items!: CallResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class CallSuccessResponseDto extends ApiSuccessResponseDto<CallResponseDto> {}
export class PaginatedCallsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedCallsResponseDto> {}

export type { CommsCallRecordingEntity };
