import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceAccountStatus } from '@prisma/client';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  ServiceAccountEntity,
  ServiceAccountTokenEntity,
} from '../entities/service-account.entity';

export class CreateServiceAccountDto {
  @ApiProperty({ example: 'CI Pipeline' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Deploys workflows from the release pipeline' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      "Role granted to this service account's membership — cannot exceed the caller's own role permissions",
  })
  @IsUUID()
  roleId!: string;
}

export class ServiceAccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: ServiceAccountStatus }) status!: ServiceAccountStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: ServiceAccountEntity): ServiceAccountResponseDto {
    const dto = new ServiceAccountResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class CreateServiceAccountTokenDto {
  @ApiProperty({ example: 'Production token' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ServiceAccountTokenResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'vsa_ab12cd34...' }) tokenPrefix!: string;
  @ApiPropertyOptional({ nullable: true }) expiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastUsedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) revokedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: ServiceAccountTokenEntity): ServiceAccountTokenResponseDto {
    const dto = new ServiceAccountTokenResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.tokenPrefix = entity.tokenPrefix;
    dto.expiresAt = entity.expiresAt?.toISOString() ?? null;
    dto.lastUsedAt = entity.lastUsedAt?.toISOString() ?? null;
    dto.revokedAt = entity.revokedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class CreateServiceAccountTokenResponseDto extends ServiceAccountTokenResponseDto {
  @ApiProperty({
    example: 'vsa_ab12cd34_9fY3z...',
    description: 'The full token — shown exactly once, never retrievable again',
  })
  token!: string;
}
