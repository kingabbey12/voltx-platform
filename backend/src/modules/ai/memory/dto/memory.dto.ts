import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { MemoryEntity } from '../entities/memory.entity';

export class CreateMemoryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ example: 'preference' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiPropertyOptional({ example: 0.85, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @ApiProperty({ example: 'User prefers deployment windows at 02:00 UTC.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({ example: 'emb_123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  embeddingId?: string;

  @ApiPropertyOptional({ example: { source: 'manual' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListMemoriesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'preference' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class MemoryResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  conversationId!: string;

  @ApiProperty({ example: 'preference' })
  category!: string;

  @ApiProperty({ example: 0.85 })
  importance!: number;

  @ApiProperty({ example: 'User prefers deployment windows at 02:00 UTC.' })
  content!: string;

  @ApiPropertyOptional({ example: 'emb_123' })
  embeddingId!: string | null;

  @ApiProperty({ example: { source: 'manual' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:05:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: MemoryEntity): MemoryResponseDto {
    const dto = new MemoryResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.category = entity.category;
    dto.importance = entity.importance;
    dto.content = entity.content;
    dto.embeddingId = entity.embeddingId;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedMemoriesDto {
  @ApiProperty({ type: [MemoryResponseDto] })
  items!: MemoryResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class MemorySuccessResponseDto extends ApiSuccessResponseDto<MemoryResponseDto> {}
export class PaginatedMemoriesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedMemoriesDto> {}
