import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { PLATFORM_ADMIN_GUARDS } from '../../common/guards/protected.guards';
import { CurrentAuthPrincipal } from '../auth/decorators/current-auth-principal.decorator';
import { AuthPrincipal } from '../auth/interfaces/auth-principal.interface';
import {
  MarketplaceAppVersionResponseDto,
  RejectMarketplaceAppVersionDto,
} from './dto/marketplace-app.dto';
import { MarketplaceVersionReviewService } from './marketplace-version-review.service';

class MarketplaceAppVersionSuccessResponseDto extends ApiSuccessResponseDto<MarketplaceAppVersionResponseDto> {}
class MarketplaceAppVersionListSuccessResponseDto extends ApiSuccessResponseDto<
  MarketplaceAppVersionResponseDto[]
> {}

/** Platform-admin review queue for submitted app versions — cross-org by
 * nature (an admin reviews every developer's submissions), so it uses
 * PLATFORM_ADMIN_GUARDS instead of any org-scoped permission, matching
 * every other Platform Console controller. */
@ApiTags('Platform Admin — Marketplace Review')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/marketplace/versions')
export class MarketplaceVersionReviewController {
  constructor(private readonly service: MarketplaceVersionReviewService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Platform admin: list app versions awaiting review' })
  @ApiOkResponse({
    description: 'Pending versions',
    type: MarketplaceAppVersionListSuccessResponseDto,
  })
  listPending(): Promise<MarketplaceAppVersionResponseDto[]> {
    return this.service.listPending();
  }

  @Post(':versionId/approve')
  @ApiOperation({ summary: 'Platform admin: approve and publish a submitted version' })
  @ApiOkResponse({ description: 'Version approved', type: MarketplaceAppVersionSuccessResponseDto })
  approve(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
  ): Promise<MarketplaceAppVersionResponseDto> {
    return this.service.approve(versionId, principal.userId);
  }

  @Post(':versionId/reject')
  @ApiOperation({ summary: 'Platform admin: reject a submitted version' })
  @ApiOkResponse({ description: 'Version rejected', type: MarketplaceAppVersionSuccessResponseDto })
  reject(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
    @Body() dto: RejectMarketplaceAppVersionDto,
  ): Promise<MarketplaceAppVersionResponseDto> {
    return this.service.reject(versionId, principal.userId, dto);
  }
}
