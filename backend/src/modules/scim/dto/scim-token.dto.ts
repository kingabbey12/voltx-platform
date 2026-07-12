import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ScimTokenStatus } from '@prisma/client';
import { ScimTokenEntity } from '../entities/scim-token.entity';

export class CreateScimTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  identityProviderId?: string;

  @IsOptional()
  expiresAt?: string;
}

export class ScimTokenResponseDto {
  id!: string;
  name!: string;
  identityProviderId!: string | null;
  status!: ScimTokenStatus;
  expiresAt!: string | null;
  lastUsedAt!: string | null;
  createdAt!: string;

  static fromEntity(entity: ScimTokenEntity): ScimTokenResponseDto {
    const dto = new ScimTokenResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.identityProviderId = entity.identityProviderId;
    dto.status = entity.status;
    dto.expiresAt = entity.expiresAt?.toISOString() ?? null;
    dto.lastUsedAt = entity.lastUsedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class CreateScimTokenResponseDto extends ScimTokenResponseDto {
  /** Shown exactly once, at creation — never retrievable again (hash-only storage, like refresh tokens). */
  token!: string;

  static fromEntityAndToken(entity: ScimTokenEntity, token: string): CreateScimTokenResponseDto {
    const dto = new CreateScimTokenResponseDto();
    Object.assign(dto, ScimTokenResponseDto.fromEntity(entity));
    dto.token = token;
    return dto;
  }
}
