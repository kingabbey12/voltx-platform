import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IdentityProviderProtocol } from '@prisma/client';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { IdentityProviderRepository } from './identity-provider.repository';
import { IdentityProviderService } from './identity-provider.service';
import { SsoService } from './sso.service';

const SSO_THROTTLE = {
  default: {
    limit: parseInt(process.env.AUTH_RATE_LIMIT_LIMIT ?? '10', 10),
    ttl: parseInt(process.env.AUTH_RATE_LIMIT_TTL_SECONDS ?? '60', 10) * 1000,
  },
};

@ApiTags('Enterprise Identity — SSO')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('saml/:idpId/login')
  @Throttle(SSO_THROTTLE)
  @ApiOperation({ summary: 'Redirect to the SAML identity provider to begin SSO login' })
  async samlLogin(
    @Param('idpId', ParseUUIDPipe) idpId: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.ssoService.initiateSamlLogin(idpId);
    response.redirect(url);
  }

  @Post('saml/:idpId/acs')
  @HttpCode(HttpStatus.OK)
  @Throttle(SSO_THROTTLE)
  @ApiOperation({
    summary: 'SAML Assertion Consumer Service — completes SSO login and issues tokens',
  })
  async samlAcs(
    @Param('idpId', ParseUUIDPipe) idpId: string,
    @Body() body: { SAMLResponse?: string; RelayState?: string },
  ): Promise<LoginResponseDto> {
    if (!body.SAMLResponse) {
      throw new BadRequestException('Missing SAMLResponse');
    }
    return this.ssoService.handleSamlAcs(idpId, body.SAMLResponse, body.RelayState);
  }

  @Get('oidc/:idpId/login')
  @Throttle(SSO_THROTTLE)
  @ApiOperation({ summary: 'Redirect to the OIDC identity provider to begin SSO login' })
  async oidcLogin(
    @Param('idpId', ParseUUIDPipe) idpId: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.ssoService.initiateOidcLogin(idpId);
    response.redirect(url);
  }

  @Get('oidc/:idpId/callback')
  @Throttle(SSO_THROTTLE)
  @ApiOperation({ summary: 'OIDC callback — completes SSO login and issues tokens' })
  async oidcCallback(
    @Param('idpId', ParseUUIDPipe) idpId: string,
    @Query() query: Record<string, string>,
  ): Promise<LoginResponseDto> {
    return this.ssoService.handleOidcCallback(idpId, query);
  }
}

@ApiTags('Enterprise Identity — SSO')
@Controller('identity/providers')
export class IdentityMetadataPublicController {
  constructor(
    private readonly identityProviderRepository: IdentityProviderRepository,
    private readonly identityProviderService: IdentityProviderService,
  ) {}

  @Get(':id/saml/metadata')
  @ApiOperation({ summary: 'Fetch this identity provider Service Provider (SP) SAML metadata XML' })
  async samlMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const entity = await this.identityProviderRepository.findByIdUnscoped(id);
    if (!entity || entity.protocol !== IdentityProviderProtocol.SAML) {
      throw new NotFoundException('Identity provider not found');
    }

    const xml = this.identityProviderService.generateSpMetadataXml(entity);
    response.setHeader('Content-Type', 'application/xml');
    response.send(xml);
  }
}
