import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

export class ListPublicMarketplaceAppsQueryDto {
  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ example: 'reporting' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PublicMarketplaceAppSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ nullable: true }) iconUrl!: string | null;
  @ApiProperty({ nullable: true }) latestVersion!: string | null;
  @ApiProperty({ nullable: true }) priceCents!: number | null;
  @ApiProperty() averageRating!: number;
  @ApiProperty() reviewCount!: number;
  @ApiProperty() createdAt!: string;

  static fromEntity(
    entity: MarketplaceAppEntity,
    latestVersion: MarketplaceAppVersionEntity | null,
    rating: { average: number; count: number },
  ): PublicMarketplaceAppSummaryDto {
    const dto = new PublicMarketplaceAppSummaryDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.category = entity.category;
    dto.iconUrl = entity.iconUrl;
    dto.latestVersion = latestVersion?.version ?? null;
    dto.priceCents = latestVersion?.priceCents ?? null;
    dto.averageRating = rating.average;
    dto.reviewCount = rating.count;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PublicMarketplaceAppListResponseDto {
  @ApiProperty({ type: [PublicMarketplaceAppSummaryDto] }) items!: PublicMarketplaceAppSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
