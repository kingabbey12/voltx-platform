import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI deploy bot' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: ['sales.opportunity.read', 'sales.opportunity.update'],
    description: "Must be a subset of the organization's real permission keys",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopedPermissions!: string[];

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'CI deploy bot' })
  name!: string;

  @ApiProperty({ example: 'vk_ab12cd34...' })
  keyPrefix!: string;

  @ApiProperty({ example: ['sales.opportunity.read'] })
  scopedPermissions!: string[];

  @ApiPropertyOptional({ example: null, nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastUsedAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revokedAt!: string | null;

  @ApiProperty({ example: '2026-07-10T12:00:00.000Z' })
  createdAt!: string;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    example: 'vk_ab12cd34_9fY3z...',
    description: 'The full API key — shown exactly once, never retrievable again',
  })
  apiKey!: string;
}
