import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateMarketplaceReviewDto,
  MarketplaceReviewResponseDto,
} from './dto/marketplace-review.dto';
import { MarketplaceReviewService } from './marketplace-review.service';

class MarketplaceReviewSuccessResponseDto extends ApiSuccessResponseDto<MarketplaceReviewResponseDto> {}

@ApiTags('Developer Platform — Marketplace Reviews')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/marketplace/apps/:appId/reviews')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class MarketplaceReviewController {
  constructor(private readonly service: MarketplaceReviewService) {}

  @Post()
  @Permissions('marketplace.review.manage')
  @ApiOperation({
    summary: 'Review an installed marketplace app (one review per organization per app)',
  })
  @ApiCreatedResponse({ description: 'Review created', type: MarketplaceReviewSuccessResponseDto })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: CreateMarketplaceReviewDto,
  ): Promise<MarketplaceReviewResponseDto> {
    return this.service.create(appId, organizationId, dto);
  }
}
