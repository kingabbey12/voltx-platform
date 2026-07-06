import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { SalesAiActionSuccessResponseDto } from '../../dto/sales-ai.dto';
import { ContactEntity } from '../entities/contact.entity';

export class CreateContactDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Taylor' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Morgan' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'taylor.morgan@acme.energy' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'VP Procurement' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Primary champion for renewable procurement.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: { timezone: 'America/New_York' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ListContactsQueryDto {
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

  @ApiPropertyOptional({ example: 'morgan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class ContactResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440101' })
  id!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440100' })
  companyId!: string | null;

  @ApiProperty({ example: 'Taylor' })
  firstName!: string;

  @ApiProperty({ example: 'Morgan' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'taylor.morgan@acme.energy' })
  email!: string | null;

  @ApiPropertyOptional({ example: '+14155552671' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'VP Procurement' })
  jobTitle!: string | null;

  @ApiPropertyOptional({ example: 'Primary champion for renewable procurement.' })
  notes!: string | null;

  @ApiProperty({ example: { timezone: 'America/New_York' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: ContactEntity): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = entity.id;
    dto.companyId = entity.companyId;
    dto.firstName = entity.firstName;
    dto.lastName = entity.lastName;
    dto.email = entity.email;
    dto.phone = entity.phone;
    dto.jobTitle = entity.jobTitle;
    dto.notes = entity.notes;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedContactsDto {
  @ApiProperty({ type: [ContactResponseDto] })
  items!: ContactResponseDto[];
  @ApiProperty({ example: 1 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class ContactSuccessResponseDto extends ApiSuccessResponseDto<ContactResponseDto> {}
export class PaginatedContactsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedContactsDto> {}
export class DraftEmailSuccessResponseDto extends SalesAiActionSuccessResponseDto {}
