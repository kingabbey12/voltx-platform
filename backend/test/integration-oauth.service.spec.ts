import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OAuthService } from '../src/modules/integrations/oauth/oauth.service';
import { OAuthProviderConfig } from '../src/modules/integrations/provider/integration-provider.types';

const config: OAuthProviderConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authorizationUrl: 'https://provider.example.com/authorize',
  tokenUrl: 'https://provider.example.com/token',
  scopes: ['scope.read', 'scope.write'],
};

describe('OAuthService', () => {
  let service: OAuthService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new OAuthService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('buildAuthorizationUrl', () => {
    it('includes client id, redirect uri, scopes, and state', () => {
      const url = new URL(
        service.buildAuthorizationUrl(config, 'state-token-123', 'https://app.voltx.io/callback'),
      );
      expect(url.origin + url.pathname).toBe('https://provider.example.com/authorize');
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.voltx.io/callback');
      expect(url.searchParams.get('scope')).toBe('scope.read scope.write');
      expect(url.searchParams.get('state')).toBe('state-token-123');
      expect(url.searchParams.get('response_type')).toBe('code');
    });

    it('includes extraAuthorizationParams when provided', () => {
      const url = new URL(
        service.buildAuthorizationUrl(
          { ...config, extraAuthorizationParams: { tenant: 'common' } },
          'state',
          'https://app.voltx.io/callback',
        ),
      );
      expect(url.searchParams.get('tenant')).toBe('common');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('posts the authorization_code grant and returns the parsed token', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              access_token: 'access-123',
              refresh_token: 'refresh-456',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'scope.read',
            }),
          ),
      });
      global.fetch = fetchMock as never;

      const result = await service.exchangeCodeForToken(
        config,
        'auth-code',
        'https://app.voltx.io/callback',
      );

      expect(result.accessToken).toBe('access-123');
      expect(result.refreshToken).toBe('refresh-456');
      expect(result.tokenType).toBe('Bearer');
      expect(result.scope).toBe('scope.read');
      expect(result.expiresAt).toBeInstanceOf(Date);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(config.tokenUrl);
      const body = new URLSearchParams(init.body as string);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('client_secret')).toBe('client-secret');
    });

    it('throws BadRequestException when the token endpoint returns an error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(
            JSON.stringify({ error: 'invalid_grant', error_description: 'Bad code' }),
          ),
      }) as never;

      await expect(
        service.exchangeCodeForToken(config, 'bad-code', 'https://app.voltx.io/callback'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the response body is not JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>not json</html>'),
      }) as never;

      await expect(
        service.exchangeCodeForToken(config, 'code', 'https://app.voltx.io/callback'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the network request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;

      await expect(
        service.exchangeCodeForToken(config, 'code', 'https://app.voltx.io/callback'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshAccessToken', () => {
    it('posts the refresh_token grant and returns a new token', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ access_token: 'new-access', token_type: 'Bearer', expires_in: 3600 }),
          ),
      });
      global.fetch = fetchMock as never;

      const result = await service.refreshAccessToken(config, 'refresh-456');

      expect(result.accessToken).toBe('new-access');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('refresh-456');
    });

    it('falls back to the prior refresh token when the provider does not return a new one', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ access_token: 'new-access', token_type: 'Bearer' })),
      }) as never;

      const result = await service.refreshAccessToken(config, 'refresh-456');
      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });
  });

  describe('unconfigured provider guard', () => {
    const unconfigured: OAuthProviderConfig = { ...config, clientId: '', clientSecret: '' };

    it('buildAuthorizationUrl throws ServiceUnavailableException instead of emitting a client_id-less URL', () => {
      expect(() =>
        service.buildAuthorizationUrl(unconfigured, 'state', 'https://app.voltx.io/callback'),
      ).toThrow(ServiceUnavailableException);
    });

    it('exchangeCodeForToken throws ServiceUnavailableException without calling the token endpoint', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as never;

      await expect(
        service.exchangeCodeForToken(unconfigured, 'code', 'https://app.voltx.io/callback'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshAccessToken throws ServiceUnavailableException without calling the token endpoint', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as never;

      await expect(service.refreshAccessToken(unconfigured, 'refresh')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('includes the provider hostname in the error message', () => {
      try {
        service.buildAuthorizationUrl(unconfigured, 'state', 'https://app.voltx.io/callback');
        fail('expected buildAuthorizationUrl to throw');
      } catch (error) {
        expect((error as Error).message).toContain('provider.example.com');
      }
    });
  });
});
