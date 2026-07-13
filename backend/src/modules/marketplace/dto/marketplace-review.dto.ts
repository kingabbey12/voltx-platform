import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MarketplaceReviewEntity } from '../entities/marketplace-review.entity';

export class CreateMarketplaceReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Great integration, saved us hours every week.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class MarketplaceReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() appId!: string;
  @ApiProperty() rating!: number;
  @ApiPropertyOptional({ nullable: true }) comment!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: MarketplaceReviewEntity): MarketplaceReviewResponseDto {
    const dto = new MarketplaceReviewResponseDto();
    dto.id = entity.id;
    dto.appId = entity.appId;
    dto.rating = entity.rating;
    dto.comment = entity.comment;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
