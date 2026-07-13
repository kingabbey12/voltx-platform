import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import {
  DecideOAuthAuthorizationDto,
  OAuthAuthorizeQueryDto,
  OAuthConsentContextResponseDto,
  OAuthDecisionResponseDto,
} from './dto/oauth-authorize.dto';
import { OAuthAuthorizationService } from './oauth-authorization.service';

class OAuthConsentContextSuccessResponseDto extends ApiSuccessResponseDto<OAuthConsentContextResponseDto> {}
class OAuthDecisionSuccessResponseDto extends ApiSuccessResponseDto<OAuthDecisionResponseDto> {}

/**
 * Called by the Voltx web app's own consent screen — never by the
 * third-party application directly. The third party redirects the user's
 * browser to a web-app URL carrying these same RFC 6749 query params; the
 * web app (already holding the user's JWT) forwards them here to render
 * the consent screen and record the user's decision.
 */
@ApiTags('Developer Platform — OAuth Authorization')
@ApiBearerAuth('JWT')
@Controller('oauth/authorize')
@UseGuards(...AUTH_GUARDS)
export class OAuthAuthorizeController {
  constructor(private readonly service: OAuthAuthorizationService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch consent-screen context for an OAuth authorization request' })
  @ApiOkResponse({ type: OAuthConsentContextSuccessResponseDto })
  getConsentContext(
    @Query() query: OAuthAuthorizeQueryDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<OAuthConsentContextResponseDto> {
    return this.service.getConsentContext(query, user);
  }

  @Post('decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Record the user's approve/deny decision and issue (or deny) an authorization code",
  })
  @ApiOkResponse({ type: OAuthDecisionSuccessResponseDto })
  decide(
    @Body() dto: DecideOAuthAuthorizationDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<OAuthDecisionResponseDto> {
    return this.service.decide(dto, user);
  }
}
