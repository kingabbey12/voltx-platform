import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketplaceAppStatus, MarketplaceAppVersionStatus } from '@prisma/client';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MarketplaceAppEntity,
  MarketplaceAppVersionEntity,
} from '../entities/marketplace-app.entity';

const CATEGORIES = [
  'PRODUCTIVITY',
  'ANALYTICS',
  'COMMUNICATION',
  'SALES',
  'FINANCE',
  'OTHER',
] as const;

export class CreateMarketplaceAppDto {
  @ApiProperty({ example: 'Acme Reporting' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Syncs Voltx sales activity into Acme dashboards' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category!: string;

  @ApiPropertyOptional({ example: 'https://acme.example/icon.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}

export class UpdateMarketplaceAppDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional({ enum: CATEGORIES }) @IsOptional() @IsIn(CATEGORIES) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() iconUrl?: string;
}

export class MarketplaceAppResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() developerOrganizationId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ nullable: true }) iconUrl!: string | null;
  @ApiProperty({ enum: MarketplaceAppStatus }) status!: MarketplaceAppStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: MarketplaceAppEntity): MarketplaceAppResponseDto {
    const dto = new MarketplaceAppResponseDto();
    dto.id = entity.id;
    dto.developerOrganizationId = entity.developerOrganizationId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.category = entity.category;
    dto.iconUrl = entity.iconUrl;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class CreateMarketplaceAppVersionDto {
  @ApiProperty({
    example: '1.0.0',
    description: 'Semantic version — must be unique per app',
  })
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must be a semantic version, e.g. 1.0.0' })
  version!: string;

  @ApiProperty({
    description: 'The Extension Framework manifest (declarative pages/widgets/nav/AI tools)',
    example: { pages: [], widgets: [], navEntries: [], aiTools: [] },
  })
  @IsObject()
  manifest!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Initial release' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changelog?: string;

  @ApiPropertyOptional({ example: 0, description: 'Price in cents — 0 means free', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  priceCents?: number;
}

export class MarketplaceAppVersionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() appId!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ type: Object }) manifest!: unknown;
  @ApiPropertyOptional({ nullable: true }) changelog!: string | null;
  @ApiProperty() priceCents!: number;
  @ApiProperty({ enum: MarketplaceAppVersionStatus }) status!: MarketplaceAppVersionStatus;
  @ApiPropertyOptional({ nullable: true }) reviewedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) rejectionReason!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(entity: MarketplaceAppVersionEntity): MarketplaceAppVersionResponseDto {
    const dto = new MarketplaceAppVersionResponseDto();
    dto.id = entity.id;
    dto.appId = entity.appId;
    dto.version = entity.version;
    dto.manifest = entity.manifest;
    dto.changelog = entity.changelog;
    dto.priceCents = entity.priceCents;
    dto.status = entity.status;
    dto.reviewedAt = entity.reviewedAt?.toISOString() ?? null;
    dto.rejectionReason = entity.rejectionReason;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class RejectMarketplaceAppVersionDto {
  @ApiProperty({
    example: 'The submitted AI tool endpoint does not respond within the timeout budget.',
  })
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
