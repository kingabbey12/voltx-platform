import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MfaSetupResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'Base32 TOTP secret, for manual entry' })
  secret!: string;

  @ApiProperty({
    example: 'otpauth://totp/Voltx:jane%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Voltx',
    description: 'otpauth:// URI — render as a QR code for authenticator apps to scan',
  })
  otpauthUrl!: string;
}

export class MfaVerifySetupDto {
  @ApiProperty({ example: '123456', description: '6-digit code from the authenticator app' })
  @IsString()
  @MaxLength(10)
  code!: string;
}

export class MfaBackupCodesResponseDto {
  @ApiProperty({ example: ['7F3K-9QZC', 'A2B4-C6D8'], type: [String] })
  backupCodes!: string[];
}

export class MfaDisableDto {
  @ApiProperty({ example: '123456', description: 'A current TOTP code or an unused backup code' })
  @IsString()
  @MaxLength(10)
  code!: string;
}

export class MfaRegenerateBackupCodesDto {
  @ApiProperty({ example: '123456', description: 'A current TOTP code or an unused backup code' })
  @IsString()
  @MaxLength(10)
  code!: string;
}

export class MfaVerifyLoginDto {
  @ApiProperty({ description: 'The mfaChallengeToken returned by POST /auth/login' })
  @IsString()
  challengeToken!: string;

  @ApiProperty({ example: '123456', description: 'A current TOTP code or an unused backup code' })
  @IsString()
  @MaxLength(10)
  code!: string;

  @ApiPropertyOptional({ description: 'Same client-generated fingerprint sent at login' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceFingerprint?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Remember this device — skip MFA on it for trustedForDays',
  })
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trustedForDays?: number;
}
