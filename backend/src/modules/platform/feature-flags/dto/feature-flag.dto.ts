import { FeatureFlagType } from '@prisma/client';
import { IsDefined, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { ResolvedFeatureFlag } from '../feature-flag.service';

export class CreateFeatureFlagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(FeatureFlagType)
  type!: FeatureFlagType;

  /** Shape depends on `type` — validated in FeatureFlagService, not here. */
  @IsDefined()
  defaultValue!: unknown;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  defaultValue?: unknown;
}

export class SetFeatureFlagOverrideDto {
  /** Shape depends on the flag's `type` — validated in FeatureFlagService. */
  @IsDefined()
  value!: unknown;
}

export class FeatureFlagResponseDto {
  id!: string;
  key!: string;
  name!: string;
  description!: string | null;
  type!: FeatureFlagType;
  defaultValue!: unknown;
  organizationOverrides!: Record<string, unknown>;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: FeatureFlagEntity): FeatureFlagResponseDto {
    const dto = new FeatureFlagResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.type = entity.type;
    dto.defaultValue = entity.defaultValue;
    dto.organizationOverrides = entity.organizationOverrides;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class ResolvedFeatureFlagResponseDto {
  key!: string;
  value!: unknown;
  source!: 'override' | 'default';

  static fromResult(result: ResolvedFeatureFlag): ResolvedFeatureFlagResponseDto {
    const dto = new ResolvedFeatureFlagResponseDto();
    dto.key = result.key;
    dto.value = result.value;
    dto.source = result.source;
    return dto;
  }
}
