import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Optional organization context for multi-tenant login',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({
    example: 'f3a1c9e0b2d4...',
    description:
      'Opaque, client-generated device fingerprint. When this device has an active TrustedDevice record for the authenticating user, a required MFA challenge is skipped.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceFingerprint?: string;
}
