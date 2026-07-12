import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TrustDeviceDto {
  @ApiProperty({ example: 'f3a1c9e0b2d4...' })
  @IsString()
  @MaxLength(255)
  deviceFingerprint!: string;

  @ApiPropertyOptional({ example: "Jane's MacBook Pro" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trustedForDays?: number;
}

export class TrustedDeviceResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiPropertyOptional({ example: "Jane's MacBook Pro", nullable: true })
  label!: string | null;

  @ApiProperty({ example: '2026-08-09T00:00:00.000Z' })
  trustedUntil!: string;

  @ApiProperty({ example: '2026-07-10T12:00:00.000Z' })
  lastSeenAt!: string;
}
