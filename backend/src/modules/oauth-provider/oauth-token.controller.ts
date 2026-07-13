import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ExchangeOAuthTokenDto,
  IntrospectOAuthTokenDto,
  OAuthIntrospectResponseDto,
  OAuthTokenResponseDto,
  RevokeOAuthTokenDto,
} from './dto/oauth-token.dto';
import { OAuthTokenService } from './oauth-token.service';

/**
 * These three endpoints are called directly by a third-party's own
 * backend using a generic OAuth2 client library — never by Voltx's own
 * web/mobile apps — so every response here is the raw RFC 6749/7009/7662
 * wire shape (snake_case, un-enveloped), not this API's usual
 * `{ success, data, meta }` wrapper. See OAUTH_TOKEN_PATH_PATTERN in
 * ResponseInterceptor for the corresponding envelope bypass, and
 * OAuthWireException for the matching error-shape bypass.
 */
@ApiTags('Developer Platform — OAuth Token Endpoint')
@Controller('oauth')
export class OAuthTokenController {
  constructor(private readonly service: OAuthTokenService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange an authorization code or refresh token for an access token (RFC 6749)',
  })
  @ApiOkResponse({ type: OAuthTokenResponseDto })
  exchangeToken(@Body() dto: ExchangeOAuthTokenDto): Promise<OAuthTokenResponseDto> {
    return this.service.exchangeToken(dto);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an access or refresh token (RFC 7009)' })
  @ApiOkResponse({ description: 'Always 200, whether or not the token existed' })
  async revoke(@Body() dto: RevokeOAuthTokenDto): Promise<Record<string, never>> {
    await this.service.revoke(dto);
    return {};
  }

  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check whether a token is active and inspect its scope/owner (RFC 7662)',
  })
  @ApiOkResponse({ type: OAuthIntrospectResponseDto })
  introspect(@Body() dto: IntrospectOAuthTokenDto): Promise<OAuthIntrospectResponseDto> {
    return this.service.introspect(dto);
  }
}
