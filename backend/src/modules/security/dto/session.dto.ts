import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SessionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiPropertyOptional({ example: 'f3a1c9e0b2d4...', nullable: true })
  deviceFingerprint!: string | null;

  @ApiPropertyOptional({ example: '203.0.113.7', nullable: true })
  ipAddress!: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0 (Macintosh; ...)', nullable: true })
  userAgent!: string | null;

  @ApiProperty({ example: '2026-07-10T12:00:00.000Z' })
  lastActiveAt!: string;

  @ApiProperty({ example: '2026-07-01T09:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Set once this session/login has been revoked',
  })
  revokedAt!: string | null;
}

/**
 * "Login history" is deliberately just every Session row for the user
 * (active and revoked), not a parallel audit-log mechanism — a Session is
 * already, by construction, created exactly once per successful login (see
 * AuthService.login()/MfaService.verifyLogin()) and already carries
 * ip/user-agent/timestamp, so there is no separate concept to invent here.
 */
export class LoginHistoryQueryDto {
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
}

export class PaginatedSessionsDto {
  @ApiProperty({ type: [SessionResponseDto] })
  items!: SessionResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
