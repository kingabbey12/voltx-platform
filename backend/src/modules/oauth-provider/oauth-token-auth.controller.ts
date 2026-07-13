import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { OAuthAccessTokenGuard } from './guards/oauth-access-token.guard';

class OAuthWhoamiResponseDto {
  organizationId!: string;
  permissions!: string[];
}

class OAuthWhoamiSuccessResponseDto extends ApiSuccessResponseDto<OAuthWhoamiResponseDto> {}

/**
 * Demonstrates and exercises OAuthAccessTokenGuard as a genuine drop-in
 * alternative to AUTH_GUARDS: this route requires no JWT/Membership at
 * all, only a valid OAuth access token via the standard
 * `Authorization: Bearer` header. Lets a third-party application
 * introspect exactly which permissions its current token carries.
 */
@ApiTags('Developer Platform — OAuth Authorization')
@ApiBearerAuth('OAuth2AccessToken')
@Controller('oauth/whoami')
@UseGuards(OAuthAccessTokenGuard)
export class OAuthTokenAuthController {
  @Get()
  @ApiOperation({
    summary: "Resolve the calling OAuth access token's organization and scoped permissions",
  })
  @ApiOkResponse({
    description: 'Resolved OAuth token context',
    type: OAuthWhoamiSuccessResponseDto,
  })
  whoami(@CurrentUser() user: CurrentUserInterface): OAuthWhoamiResponseDto {
    return {
      organizationId: user.organizationId,
      permissions: user.permissions,
    };
  }
}
