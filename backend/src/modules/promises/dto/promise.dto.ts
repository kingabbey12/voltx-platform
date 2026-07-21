import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { PromiseEntity, PromiseEventEntity, PromisePartyEntity } from '../entities/promise.entity';

const PROMISE_STATUSES = ['PROPOSED', 'STANDING', 'FULFILLED', 'RELEASED', 'BROKEN'] as const;
const PROMISE_PARTY_ROLES = ['OBLIGOR', 'OBLIGEE'] as const;

export class CreatePromisePartyDto {
  @ApiProperty({ enum: PROMISE_PARTY_ROLES, example: 'OBLIGEE' })
  @IsEnum(PROMISE_PARTY_ROLES)
  role!: (typeof PROMISE_PARTY_ROLES)[number];

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440200' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class CreatePromiseDto {
  @ApiProperty({ example: 'Standing reorder — Marlin Hospitality' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440200' })
  @IsUUID()
  ownerId!: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiProperty({ type: [CreatePromisePartyDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePromisePartyDto)
  parties!: CreatePromisePartyDto[];
}

export class UpdatePromiseDto {
  @ApiPropertyOptional({ example: 'Standing reorder — Marlin Hospitality' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440200' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ type: [CreatePromisePartyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePromisePartyDto)
  parties?: CreatePromisePartyDto[];
}

export class TransitionPromiseDto {
  @ApiPropertyOptional({ example: 'Confirmed verbally on the renewal call.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ListPromisesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PROMISE_STATUSES })
  @IsOptional()
  @IsEnum(PROMISE_STATUSES)
  status?: (typeof PROMISE_STATUSES)[number];

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440200' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: 'reorder' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class PromisePartyResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440300' })
  id!: string;

  @ApiProperty({ enum: PROMISE_PARTY_ROLES })
  role!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  contactId!: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440200' })
  userId!: string | null;

  static fromEntity(entity: PromisePartyEntity): PromisePartyResponseDto {
    const dto = new PromisePartyResponseDto();
    dto.id = entity.id;
    dto.role = entity.role;
    dto.contactId = entity.contactId;
    dto.userId = entity.userId;
    return dto;
  }
}

export class PromiseResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440400' })
  id!: string;

  @ApiProperty({ example: 'Standing reorder — Marlin Hospitality' })
  title!: string;

  @ApiProperty({ enum: PROMISE_STATUSES })
  status!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440200' })
  ownerId!: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  dueAt!: string | null;

  @ApiProperty({ type: [PromisePartyResponseDto] })
  parties!: PromisePartyResponseDto[];

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: PromiseEntity): PromiseResponseDto {
    const dto = new PromiseResponseDto();
    dto.id = entity.id;
    dto.title = entity.title;
    dto.status = entity.status;
    dto.ownerId = entity.ownerId;
    dto.dueAt = entity.dueAt ? entity.dueAt.toISOString() : null;
    dto.parties = entity.parties.map((party) => PromisePartyResponseDto.fromEntity(party));
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedPromisesDto {
  @ApiProperty({ type: [PromiseResponseDto] })
  items!: PromiseResponseDto[];
  @ApiProperty({ example: 1 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PromiseEventResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440500' })
  id!: string;

  @ApiProperty({ example: 'STATUS_CHANGED' })
  type!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440200' })
  actorId!: string | null;

  @ApiProperty({ example: { from: 'PROPOSED', to: 'STANDING' } })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  occurredAt!: string;

  static fromEntity(entity: PromiseEventEntity): PromiseEventResponseDto {
    const dto = new PromiseEventResponseDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.actorId = entity.actorId;
    dto.payload = entity.payload;
    dto.occurredAt = entity.occurredAt.toISOString();
    return dto;
  }
}

export class PromiseSuccessResponseDto extends ApiSuccessResponseDto<PromiseResponseDto> {}
export class PaginatedPromisesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedPromisesDto> {}
export class PromiseEventsSuccessResponseDto extends ApiSuccessResponseDto<
  PromiseEventResponseDto[]
> {}
