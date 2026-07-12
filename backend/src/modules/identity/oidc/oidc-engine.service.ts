import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generators, Issuer } from 'openid-client';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { OidcConfigurationEntity } from '../entities/identity-provider.entity';

export interface OidcAuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
}

export interface OidcProfile {
  subject: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
  raw: Record<string, unknown>;
}

/**
 * Single OIDC protocol engine shared by every preset (Entra ID, Okta,
 * Google Workspace, OneLogin, Ping Identity) — presets only change
 * form defaults/scopes/claim-name hints, never this discovery/token/
 * userinfo path, which is entirely delegated to openid-client.
 */
@Injectable()
export class OidcEngineService {
  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  buildRedirectUri(identityProviderId: string): string {
    return `${this.getWebhookBaseUrl()}/api/v1/auth/sso/oidc/${identityProviderId}/callback`;
  }

  private getWebhookBaseUrl(): string {
    const base = this.configService.get<string>('integrations.webhookBaseUrl', '');
    if (!base) {
      throw new BadRequestException(
        'INTEGRATIONS_WEBHOOK_BASE_URL must be configured to construct OIDC redirect URIs',
      );
    }
    return base.replace(/\/$/, '');
  }

  private async buildClient(config: OidcConfigurationEntity, identityProviderId: string) {
    const clientSecret = this.encryptionService.decrypt(config.clientSecret);

    const issuer =
      config.authorizationEndpoint && config.tokenEndpoint
        ? new Issuer({
            issuer: config.issuer,
            authorization_endpoint: config.authorizationEndpoint,
            token_endpoint: config.tokenEndpoint,
            userinfo_endpoint: config.userinfoEndpoint ?? undefined,
            jwks_uri: config.jwksUri ?? undefined,
          })
        : await Issuer.discover(config.issuer);

    return new issuer.Client({
      client_id: config.clientId,
      client_secret: clientSecret,
      redirect_uris: [this.buildRedirectUri(identityProviderId)],
      response_types: ['code'],
    });
  }

  async getAuthorizationRequest(
    config: OidcConfigurationEntity,
    identityProviderId: string,
    params: { state: string; nonce: string },
  ): Promise<OidcAuthorizationRequest> {
    const client = await this.buildClient(config, identityProviderId);

    const url = client.authorizationUrl({
      scope: config.scopes.join(' '),
      state: params.state,
      nonce: params.nonce,
    });

    return { url, state: params.state, nonce: params.nonce };
  }

  /**
   * The `state` param itself carries no server-side session — SsoService
   * signs {identityProviderId, nonce, relayState} into it (see
   * SsoService.buildOidcState) so the callback can recover the nonce
   * without any shared storage between the login-init and callback
   * requests, which may hit different backend instances.
   */
  generateNonce(): string {
    return generators.nonce();
  }

  async handleCallback(
    config: OidcConfigurationEntity,
    identityProviderId: string,
    callbackParams: Record<string, string>,
    expected: { state: string; nonce: string },
  ): Promise<OidcProfile> {
    const client = await this.buildClient(config, identityProviderId);
    const redirectUri = this.buildRedirectUri(identityProviderId);

    const tokenSet = await client.callback(redirectUri, callbackParams, {
      state: expected.state,
      nonce: expected.nonce,
    });

    const claims = tokenSet.claims();
    const mapping = config.claimsMapping ?? {};

    const emailClaim = mapping.email ?? 'email';
    const firstNameClaim = mapping.firstName ?? 'given_name';
    const lastNameClaim = mapping.lastName ?? 'family_name';
    const groupsClaim = mapping.groups ?? 'groups';

    const groupsValue = (claims as Record<string, unknown>)[groupsClaim];
    const groups = Array.isArray(groupsValue)
      ? groupsValue.map(String)
      : typeof groupsValue === 'string'
        ? [groupsValue]
        : [];

    return {
      subject: claims.sub,
      email: (claims[emailClaim] as string | undefined) ?? null,
      firstName: (claims as Record<string, unknown>)[firstNameClaim] as string | null,
      lastName: (claims as Record<string, unknown>)[lastNameClaim] as string | null,
      groups,
      raw: claims as unknown as Record<string, unknown>,
    };
  }
}
