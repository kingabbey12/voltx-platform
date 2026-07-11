import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OAuthProviderConfig, OAuthTokenResult } from '../provider/integration-provider.types';

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
}

/**
 * Centralized OAuth2 handling — authorization URL construction, code
 * exchange, and token refresh — parameterized per-provider by
 * OAuthProviderConfig so every connector shares ONE implementation of the
 * OAuth2 grant dance rather than each reimplementing it. Connectors never
 * see client secrets or raw HTTP token responses; they only ever receive
 * an already-decrypted IntegrationCredentialValue from the caller.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  buildAuthorizationUrl(config: OAuthProviderConfig, state: string, redirectUri: string): string {
    this.assertConfigured(config);
    const url = new URL(config.authorizationUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    for (const [key, value] of Object.entries(config.extraAuthorizationParams ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async exchangeCodeForToken(
    config: OAuthProviderConfig,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokenResult> {
    this.assertConfigured(config);
    return this.requestToken(config, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
  }

  async refreshAccessToken(
    config: OAuthProviderConfig,
    refreshToken: string,
  ): Promise<OAuthTokenResult> {
    this.assertConfigured(config);
    return this.requestToken(config, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
  }

  /**
   * OAuth client credentials are optional at the platform-config level
   * (a deployment may not offer every third-party integration), so this
   * can't be a boot-time requirement the way encryption/storage/Redis are.
   * Without this guard, a missing clientId/clientSecret silently produces
   * a broken authorization URL (`client_id=`) or a token request that
   * fails opaquely at the provider — this fails closed with a clear
   * message the moment someone actually tries to use the unconfigured
   * provider.
   */
  private assertConfigured(config: OAuthProviderConfig): void {
    if (!config.clientId || !config.clientSecret) {
      const provider = this.providerHostname(config.authorizationUrl);
      throw new ServiceUnavailableException(
        `OAuth is not configured for ${provider} — missing client ID or client secret`,
      );
    }
  }

  private providerHostname(authorizationUrl: string): string {
    try {
      return new URL(authorizationUrl).hostname;
    } catch {
      return 'this provider';
    }
  }

  private async requestToken(
    config: OAuthProviderConfig,
    params: Record<string, string>,
  ): Promise<OAuthTokenResult> {
    let response: Response;
    try {
      response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams(params).toString(),
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to reach OAuth token endpoint: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    const text = await response.text();
    let body: RawTokenResponse;
    try {
      body = JSON.parse(text) as RawTokenResponse;
    } catch {
      throw new BadRequestException(
        `OAuth token endpoint returned a non-JSON response: ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok || !body.access_token) {
      this.logger.warn({ status: response.status, body }, 'OAuth token request failed');
      throw new BadRequestException(
        `OAuth token request failed with status ${response.status}: ${
          (body as { error_description?: string; error?: string }).error_description ??
          (body as { error?: string }).error ??
          'unknown error'
        }`,
      );
    }

    const { access_token, refresh_token, token_type, expires_in, scope, ...extra } = body;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenType: token_type ?? 'Bearer',
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      scope,
      extra,
    };
  }
}
