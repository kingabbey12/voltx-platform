import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PasswordPolicyDto {
  @ApiPropertyOptional({ example: 8, minimum: 8, maximum: 128 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  minLength?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireNumber?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireSymbol?: boolean;
}

export class UpdateSecurityPolicyDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @ApiPropertyOptional({ type: PasswordPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PasswordPolicyDto)
  passwordPolicy?: PasswordPolicyDto;

  @ApiPropertyOptional({
    example: ['203.0.113.7', '10.0.0.0/8'],
    description: 'Exact IPs and/or IPv4 CIDR ranges. Empty array removes the restriction.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipAllowlist?: string[];
}

export class SecurityPolicyResponseDto {
  @ApiProperty({ example: false })
  mfaRequired!: boolean;

  @ApiProperty({ type: PasswordPolicyDto })
  passwordPolicy!: Required<PasswordPolicyDto>;

  @ApiProperty({ example: [] })
  ipAllowlist!: string[];
}
