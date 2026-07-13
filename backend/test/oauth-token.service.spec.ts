import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthApplicationStatus } from '@prisma/client';
import { AuditService } from '../src/modules/audit/audit.service';
import { OAuthApplicationWithRedirectUrisEntity } from '../src/modules/oauth-provider/entities/oauth-application.entity';
import {
  OAuthAccessTokenEntity,
  OAuthAuthorizationCodeEntity,
  OAuthRefreshTokenEntity,
} from '../src/modules/oauth-provider/entities/oauth-token.entity';
import { OAuthWireException } from '../src/modules/oauth-provider/errors/oauth-wire.exception';
import { OAuthApplicationRepository } from '../src/modules/oauth-provider/oauth-application.repository';
import { OAuthAuthorizationCodeRepository } from '../src/modules/oauth-provider/oauth-authorization-code.repository';
import { OAuthTokenRepository } from '../src/modules/oauth-provider/oauth-token.repository';
import { OAuthTokenService } from '../src/modules/oauth-provider/oauth-token.service';
import { sha256Hex } from '../src/modules/security/utils/security-hash.util';
import { computeCodeChallengeS256 } from '../src/modules/oauth-provider/utils/pkce.util';

const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CODE_CHALLENGE = computeCodeChallengeS256(CODE_VERIFIER);
const CLIENT_SECRET = 'vcs_rawsecretvalue';

function makeApplication(
  overrides: Partial<OAuthApplicationWithRedirectUrisEntity> = {},
): OAuthApplicationWithRedirectUrisEntity {
  return {
    id: 'app-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'Acme Reporting',
    description: null,
    logoUrl: null,
    clientId: 'client_abc123',
    clientSecretHash: sha256Hex(CLIENT_SECRET),
    clientSecretPrefix: 'vcs_ab12cd34...',
    scopes: ['sales.opportunity.read'],
    status: OAuthApplicationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    redirectUris: [],
    ...overrides,
  };
}

function makeCode(
  overrides: Partial<OAuthAuthorizationCodeEntity> = {},
): OAuthAuthorizationCodeEntity {
  return {
    id: 'code-1',
    applicationId: 'app-1',
    authorizingUserId: 'user-1',
    authorizingOrganizationId: 'org-1',
    codeHash: 'hash',
    redirectUri: 'https://acme.example/callback',
    scopes: ['sales.opportunity.read'],
    codeChallenge: CODE_CHALLENGE,
    codeChallengeMethod: 'S256',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAccessToken(overrides: Partial<OAuthAccessTokenEntity> = {}): OAuthAccessTokenEntity {
  return {
    id: 'access-1',
    applicationId: 'app-1',
    authorizingUserId: 'user-1',
    authorizingOrganizationId: 'org-1',
    tokenHash: 'hash',
    tokenPrefix: 'voat_ab12cd34...',
    scopes: ['sales.opportunity.read'],
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRefreshToken(
  overrides: Partial<OAuthRefreshTokenEntity> = {},
): OAuthRefreshTokenEntity {
  return {
    id: 'refresh-1',
    applicationId: 'app-1',
    accessTokenId: 'access-1',
    authorizingUserId: 'user-1',
    authorizingOrganizationId: 'org-1',
    tokenHash: 'hash',
    scopes: ['sales.opportunity.read'],
    expiresAt: new Date(Date.now() + 2592000_000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('OAuthTokenService', () => {
  let service: OAuthTokenService;
  let applicationRepository: jest.Mocked<OAuthApplicationRepository>;
  let authorizationCodeRepository: jest.Mocked<OAuthAuthorizationCodeRepository>;
  let tokenRepository: jest.Mocked<OAuthTokenRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthTokenService,
        {
          provide: OAuthApplicationRepository,
          useValue: { findActiveByClientId: jest.fn() },
        },
        {
          provide: OAuthAuthorizationCodeRepository,
          useValue: { findActiveByHash: jest.fn(), tryConsume: jest.fn() },
        },
        {
          provide: OAuthTokenRepository,
          useValue: {
            createPair: jest.fn(),
            findActiveAccessTokenByHash: jest.fn(),
            findActiveRefreshTokenByHash: jest.fn(),
            findAccessTokenByHashForApplication: jest.fn(),
            findRefreshTokenByHashForApplication: jest.fn(),
            revokeAccessToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { recordWithExplicitActor: jest.fn() } },
      ],
    }).compile();

    service = module.get(OAuthTokenService);
    applicationRepository = module.get(OAuthApplicationRepository);
    authorizationCodeRepository = module.get(OAuthAuthorizationCodeRepository);
    tokenRepository = module.get(OAuthTokenRepository);
  });

  describe('client authentication', () => {
    it('rejects an unknown client_id with an RFC-shaped invalid_client error', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(null);

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_unknown',
          client_secret: 'whatever',
        }),
      ).rejects.toThrow(OAuthWireException);

      try {
        await service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_unknown',
          client_secret: 'whatever',
        });
        throw new Error('expected exchangeToken to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthWireException);
        expect((error as OAuthWireException).getStatus()).toBe(401);
        expect((error as OAuthWireException).getResponse()).toMatchObject({
          error: 'invalid_client',
        });
      }
    });

    it('rejects a wrong client_secret with invalid_client', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: 'wrong-secret',
        }),
      ).rejects.toThrow(OAuthWireException);
    });
  });

  describe('authorization_code grant', () => {
    it('rejects when code, redirect_uri, or code_verifier is missing', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
        }),
      ).rejects.toThrow(OAuthWireException);
    });

    it('rejects an unknown or already-consumed code', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.findActiveByHash.mockResolvedValue(null);

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
          code: 'bad-code',
          redirect_uri: 'https://acme.example/callback',
          code_verifier: CODE_VERIFIER,
        }),
      ).rejects.toThrow(OAuthWireException);
    });

    it('rejects a redirect_uri that does not match the one used to obtain the code', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.findActiveByHash.mockResolvedValue(makeCode());

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
          code: 'good-code',
          redirect_uri: 'https://different.example/callback',
          code_verifier: CODE_VERIFIER,
        }),
      ).rejects.toThrow(OAuthWireException);
      expect(authorizationCodeRepository.tryConsume).not.toHaveBeenCalled();
    });

    it('rejects a code_verifier that does not match the code_challenge', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.findActiveByHash.mockResolvedValue(makeCode());

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
          code: 'good-code',
          redirect_uri: 'https://acme.example/callback',
          code_verifier: 'totally-wrong-verifier-value-that-does-not-match-1234567890',
        }),
      ).rejects.toThrow(OAuthWireException);
      expect(authorizationCodeRepository.tryConsume).not.toHaveBeenCalled();
    });

    it('rejects a replayed code (concurrent consumption loses the race)', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.findActiveByHash.mockResolvedValue(makeCode());
      authorizationCodeRepository.tryConsume.mockResolvedValue(false);

      await expect(
        service.exchangeToken({
          grant_type: 'authorization_code',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
          code: 'good-code',
          redirect_uri: 'https://acme.example/callback',
          code_verifier: CODE_VERIFIER,
        }),
      ).rejects.toThrow(OAuthWireException);
    });

    it('issues an access/refresh token pair on a valid exchange', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.findActiveByHash.mockResolvedValue(makeCode());
      authorizationCodeRepository.tryConsume.mockResolvedValue(true);
      tokenRepository.createPair.mockResolvedValue({
        accessToken: makeAccessToken(),
        refreshToken: makeRefreshToken(),
      });

      const result = await service.exchangeToken({
        grant_type: 'authorization_code',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
        code: 'good-code',
        redirect_uri: 'https://acme.example/callback',
        code_verifier: CODE_VERIFIER,
      });

      expect(result.access_token).toMatch(/^voat_/);
      expect(result.refresh_token).toMatch(/^vort_/);
      expect(result.token_type).toBe('Bearer');
      expect(result.scope).toBe('sales.opportunity.read');
    });
  });

  describe('refresh_token grant', () => {
    it('rejects an invalid or expired refresh token', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findActiveRefreshTokenByHash.mockResolvedValue(null);

      await expect(
        service.exchangeToken({
          grant_type: 'refresh_token',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
          refresh_token: 'bad-refresh-token',
        }),
      ).rejects.toThrow(OAuthWireException);
    });

    it('rotates the refresh token on use — the old one is revoked', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findActiveRefreshTokenByHash.mockResolvedValue(makeRefreshToken());
      tokenRepository.createPair.mockResolvedValue({
        accessToken: makeAccessToken(),
        refreshToken: makeRefreshToken({ id: 'refresh-2' }),
      });

      const result = await service.exchangeToken({
        grant_type: 'refresh_token',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
        refresh_token: 'a-valid-refresh-token',
      });

      expect(tokenRepository.revokeRefreshToken).toHaveBeenCalledWith('refresh-1');
      expect(tokenRepository.revokeAccessToken).toHaveBeenCalledWith('access-1');
      expect(result.access_token).toMatch(/^voat_/);
    });
  });

  describe('revoke', () => {
    it('does not throw for a token that does not exist (RFC 7009 §2.1)', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findAccessTokenByHashForApplication.mockResolvedValue(null);
      tokenRepository.findRefreshTokenByHashForApplication.mockResolvedValue(null);

      await expect(
        service.revoke({
          token: 'unknown-token',
          client_id: 'client_abc123',
          client_secret: CLIENT_SECRET,
        }),
      ).resolves.toBeUndefined();
      expect(tokenRepository.revokeAccessToken).not.toHaveBeenCalled();
    });

    it('revokes a known access token belonging to the authenticated client', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findAccessTokenByHashForApplication.mockResolvedValue(makeAccessToken());

      await service.revoke({
        token: 'a-real-access-token',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
      });

      expect(tokenRepository.revokeAccessToken).toHaveBeenCalledWith('access-1');
    });
  });

  describe('introspect', () => {
    it('reports active: false for an unknown token', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findAccessTokenByHashForApplication.mockResolvedValue(null);
      tokenRepository.findRefreshTokenByHashForApplication.mockResolvedValue(null);

      const result = await service.introspect({
        token: 'unknown',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
      });

      expect(result).toEqual({ active: false });
    });

    it('reports active: true with scope and sub for a valid access token', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findAccessTokenByHashForApplication.mockResolvedValue(makeAccessToken());

      const result = await service.introspect({
        token: 'a-real-access-token',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
      });

      expect(result.active).toBe(true);
      expect(result.scope).toBe('sales.opportunity.read');
      expect(result.sub).toBe('user-1');
      expect(result.token_type).toBe('access_token');
    });

    it('reports active: false for a revoked access token', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      tokenRepository.findAccessTokenByHashForApplication.mockResolvedValue(
        makeAccessToken({ revokedAt: new Date() }),
      );
      tokenRepository.findRefreshTokenByHashForApplication.mockResolvedValue(null);

      const result = await service.introspect({
        token: 'a-revoked-token',
        client_id: 'client_abc123',
        client_secret: CLIENT_SECRET,
      });

      expect(result).toEqual({ active: false });
    });
  });
});
