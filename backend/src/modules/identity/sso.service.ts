import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IdentityProviderProtocol, IdentityProviderStatus } from '@prisma/client';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { IdentityProviderEntity } from './entities/identity-provider.entity';
import { IdentityProviderRepository } from './identity-provider.repository';
import { JitProvisioningService } from './jit/jit-provisioning.service';
import { OidcEngineService } from './oidc/oidc-engine.service';
import { SamlEngineService } from './saml/saml-engine.service';

interface OidcStatePayload {
  purpose: 'sso_oidc_state';
  idp: string;
  nonce: string;
}

const OIDC_STATE_EXPIRES_IN = '10m';

@Injectable()
export class SsoService {
  constructor(
    private readonly identityProviderRepository: IdentityProviderRepository,
    private readonly samlEngineService: SamlEngineService,
    private readonly oidcEngineService: OidcEngineService,
    private readonly jitProvisioningService: JitProvisioningService,
    private readonly jwtService: JwtService,
  ) {}

  async initiateSamlLogin(identityProviderId: string): Promise<string> {
    const idp = await this.getActiveIdpOrThrow(identityProviderId, IdentityProviderProtocol.SAML);
    if (!idp.samlConfiguration) {
      throw new BadRequestException('This identity provider is not configured for SAML');
    }

    const relayState = await this.jwtService.signAsync(
      { purpose: 'sso_saml_relay_state', idp: idp.id },
      { expiresIn: OIDC_STATE_EXPIRES_IN },
    );

    return this.samlEngineService.getLoginRedirectUrl(idp.samlConfiguration, idp.id, relayState);
  }

  async handleSamlAcs(
    identityProviderId: string,
    samlResponse: string,
    relayState: string | undefined,
  ): Promise<LoginResponseDto> {
    const idp = await this.getActiveIdpOrThrow(identityProviderId, IdentityProviderProtocol.SAML);
    if (!idp.samlConfiguration) {
      throw new BadRequestException('This identity provider is not configured for SAML');
    }

    if (relayState) {
      await this.verifyRelayStateBelongsToIdp(relayState, idp.id);
    }

    const profile = await this.samlEngineService.validateAssertion(
      idp.samlConfiguration,
      idp.id,
      samlResponse,
      relayState,
    );

    return this.jitProvisioningService.provisionAndIssueTokens(idp, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      groups: profile.groups,
    });
  }

  async initiateOidcLogin(identityProviderId: string): Promise<string> {
    const idp = await this.getActiveIdpOrThrow(identityProviderId, IdentityProviderProtocol.OIDC);
    if (!idp.oidcConfiguration) {
      throw new BadRequestException('This identity provider is not configured for OIDC');
    }

    const nonce = this.oidcEngineService.generateNonce();
    const state = await this.signOidcState({ purpose: 'sso_oidc_state', idp: idp.id, nonce });

    const { url } = await this.oidcEngineService.getAuthorizationRequest(
      idp.oidcConfiguration,
      idp.id,
      { state, nonce },
    );
    return url;
  }

  async handleOidcCallback(
    identityProviderId: string,
    callbackParams: Record<string, string>,
  ): Promise<LoginResponseDto> {
    const idp = await this.getActiveIdpOrThrow(identityProviderId, IdentityProviderProtocol.OIDC);
    if (!idp.oidcConfiguration) {
      throw new BadRequestException('This identity provider is not configured for OIDC');
    }

    const state = callbackParams.state;
    if (!state) {
      throw new UnauthorizedException('Missing state parameter');
    }
    const statePayload = await this.verifyOidcState(state, idp.id);

    const profile = await this.oidcEngineService.handleCallback(
      idp.oidcConfiguration,
      idp.id,
      callbackParams,
      { state, nonce: statePayload.nonce },
    );

    return this.jitProvisioningService.provisionAndIssueTokens(idp, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      groups: profile.groups,
    });
  }

  private async getActiveIdpOrThrow(
    id: string,
    expectedProtocol: IdentityProviderProtocol,
  ): Promise<IdentityProviderEntity> {
    const idp = await this.identityProviderRepository.findByIdUnscoped(id);
    if (!idp || idp.protocol !== expectedProtocol) {
      throw new UnauthorizedException('Identity provider not found');
    }
    if (idp.status !== IdentityProviderStatus.ACTIVE) {
      throw new UnauthorizedException('This identity provider is not active');
    }
    return idp;
  }

  private async signOidcState(payload: OidcStatePayload): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn: OIDC_STATE_EXPIRES_IN });
  }

  private async verifyOidcState(state: string, expectedIdpId: string): Promise<OidcStatePayload> {
    let payload: OidcStatePayload;
    try {
      payload = await this.jwtService.verifyAsync<OidcStatePayload>(state);
    } catch {
      throw new UnauthorizedException('Invalid or expired SSO state');
    }
    if (payload.purpose !== 'sso_oidc_state' || payload.idp !== expectedIdpId) {
      throw new UnauthorizedException('SSO state does not match this identity provider');
    }
    return payload;
  }

  private async verifyRelayStateBelongsToIdp(
    relayState: string,
    expectedIdpId: string,
  ): Promise<void> {
    let payload: { purpose: string; idp: string };
    try {
      payload = await this.jwtService.verifyAsync<{ purpose: string; idp: string }>(relayState);
    } catch {
      throw new UnauthorizedException('Invalid or expired SSO relay state');
    }
    if (payload.purpose !== 'sso_saml_relay_state' || payload.idp !== expectedIdpId) {
      throw new UnauthorizedException('SSO relay state does not match this identity provider');
    }
  }
}
