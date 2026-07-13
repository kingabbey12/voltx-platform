import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import {
  ListPublicMarketplaceAppsQueryDto,
  PublicMarketplaceAppListResponseDto,
  PublicMarketplaceAppSummaryDto,
} from './dto/marketplace-public.dto';
import { MarketplaceReviewResponseDto } from './dto/marketplace-review.dto';
import { MarketplacePublicService } from './marketplace-public.service';
import { MarketplaceReviewService } from './marketplace-review.service';

class PublicMarketplaceAppListSuccessResponseDto extends ApiSuccessResponseDto<PublicMarketplaceAppListResponseDto> {}
class PublicMarketplaceAppSuccessResponseDto extends ApiSuccessResponseDto<PublicMarketplaceAppSummaryDto> {}
class MarketplaceReviewListSuccessResponseDto extends ApiSuccessResponseDto<
  MarketplaceReviewResponseDto[]
> {}

/** Unauthenticated browse — zero guards, mirrors BrandingPublicController,
 * since a prospective installer should be able to browse the marketplace
 * before signing in. */
@ApiTags('Marketplace — Public')
@Controller('marketplace/public/apps')
export class MarketplacePublicController {
  constructor(
    private readonly publicService: MarketplacePublicService,
    private readonly reviewService: MarketplaceReviewService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Unauthenticated: browse/search published marketplace apps' })
  @ApiOkResponse({
    description: 'Published apps',
    type: PublicMarketplaceAppListSuccessResponseDto,
  })
  list(
    @Query() query: ListPublicMarketplaceAppsQueryDto,
  ): Promise<PublicMarketplaceAppListResponseDto> {
    return this.publicService.list({
      category: query.category,
      search: query.search,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':appId')
  @ApiOperation({ summary: 'Unauthenticated: get a published marketplace app by id' })
  @ApiOkResponse({ description: 'App', type: PublicMarketplaceAppSuccessResponseDto })
  getOne(@Param('appId', ParseUUIDPipe) appId: string): Promise<PublicMarketplaceAppSummaryDto> {
    return this.publicService.getOrThrow(appId);
  }

  @Get(':appId/reviews')
  @ApiOperation({ summary: 'Unauthenticated: list reviews for a marketplace app' })
  @ApiOkResponse({ description: 'Reviews', type: MarketplaceReviewListSuccessResponseDto })
  listReviews(
    @Param('appId', ParseUUIDPipe) appId: string,
  ): Promise<MarketplaceReviewResponseDto[]> {
    return this.reviewService.listForApp(appId);
  }
}
