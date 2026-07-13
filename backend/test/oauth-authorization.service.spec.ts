import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthApplicationStatus } from '@prisma/client';
import { CurrentUser } from '../src/modules/auth/interfaces/current-user.interface';
import { AuditService } from '../src/modules/audit/audit.service';
import { OAuthApplicationWithRedirectUrisEntity } from '../src/modules/oauth-provider/entities/oauth-application.entity';
import { OAuthApplicationRepository } from '../src/modules/oauth-provider/oauth-application.repository';
import { OAuthAuthorizationCodeRepository } from '../src/modules/oauth-provider/oauth-authorization-code.repository';
import { OAuthAuthorizationService } from '../src/modules/oauth-provider/oauth-authorization.service';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';

function makeApplication(
  overrides: Partial<OAuthApplicationWithRedirectUrisEntity> = {},
): OAuthApplicationWithRedirectUrisEntity {
  return {
    id: 'app-1',
    organizationId: 'dev-org-1',
    ownerUserId: 'dev-user-1',
    name: 'Acme Reporting',
    description: null,
    logoUrl: null,
    clientId: 'client_abc123',
    clientSecretHash: 'hash',
    clientSecretPrefix: 'vcs_ab12cd34...',
    scopes: ['sales.opportunity.read'],
    status: OAuthApplicationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    redirectUris: [
      {
        id: 'uri-1',
        applicationId: 'app-1',
        uri: 'https://acme.example/callback',
        createdAt: new Date(),
      },
    ],
    ...overrides,
  };
}

const currentUser: CurrentUser = {
  id: 'user-1',
  organizationId: 'org-1',
  membershipId: 'membership-1',
  roles: ['member'],
  permissions: ['sales.opportunity.read'],
};

describe('OAuthAuthorizationService', () => {
  let service: OAuthAuthorizationService;
  let applicationRepository: jest.Mocked<OAuthApplicationRepository>;
  let authorizationCodeRepository: jest.Mocked<OAuthAuthorizationCodeRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthAuthorizationService,
        {
          provide: OAuthApplicationRepository,
          useValue: { findActiveByClientId: jest.fn() },
        },
        {
          provide: OAuthAuthorizationCodeRepository,
          useValue: { create: jest.fn() },
        },
        {
          provide: PermissionRepository,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([
                { key: 'sales.opportunity.read', description: 'Read sales opportunities' },
              ]),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(OAuthAuthorizationService);
    applicationRepository = module.get(OAuthApplicationRepository);
    authorizationCodeRepository = module.get(OAuthAuthorizationCodeRepository);
  });

  const baseQuery = {
    client_id: 'client_abc123',
    redirect_uri: 'https://acme.example/callback',
    response_type: 'code',
    scope: 'sales.opportunity.read',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  };

  describe('getConsentContext', () => {
    it('rejects an unknown client_id', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(null);
      await expect(service.getConsentContext(baseQuery, currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a redirect_uri not registered for the application', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      await expect(
        service.getConsentContext(
          { ...baseQuery, redirect_uri: 'https://evil.example/callback' },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-S256 code_challenge_method', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      await expect(
        service.getConsentContext({ ...baseQuery, code_challenge_method: 'plain' }, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a scope the application is not registered for', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(
        makeApplication({ scopes: ['sales.contact.read'] }),
      );
      await expect(service.getConsentContext(baseQuery, currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a scope the authorizing user doesn't currently hold", async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      await expect(
        service.getConsentContext(baseQuery, { ...currentUser, permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns consent context with human-readable scope descriptions', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      const context = await service.getConsentContext(baseQuery, currentUser);

      expect(context.applicationName).toBe('Acme Reporting');
      expect(context.scopes).toEqual([
        { key: 'sales.opportunity.read', description: 'Read sales opportunities' },
      ]);
    });
  });

  describe('decide', () => {
    it('returns an access_denied redirect without creating a code when denied', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());

      const result = await service.decide(
        { ...baseQuery, state: 'xyz123', decision: 'deny' },
        currentUser,
      );

      expect(result.redirectUrl).toContain('error=access_denied');
      expect(result.redirectUrl).toContain('state=xyz123');
      expect(authorizationCodeRepository.create).not.toHaveBeenCalled();
    });

    it('creates a single-use authorization code and returns it in the redirect on approval', async () => {
      applicationRepository.findActiveByClientId.mockResolvedValue(makeApplication());
      authorizationCodeRepository.create.mockResolvedValue({
        id: 'code-1',
        applicationId: 'app-1',
        authorizingUserId: 'user-1',
        authorizingOrganizationId: 'org-1',
        codeHash: 'hash',
        redirectUri: baseQuery.redirect_uri,
        scopes: ['sales.opportunity.read'],
        codeChallenge: baseQuery.code_challenge,
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await service.decide(
        { ...baseQuery, state: 'xyz123', decision: 'approve' },
        currentUser,
      );

      expect(result.redirectUrl).toContain('code=');
      expect(result.redirectUrl).toContain('state=xyz123');
      expect(authorizationCodeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-1',
          authorizingUserId: 'user-1',
          authorizingOrganizationId: 'org-1',
          scopes: ['sales.opportunity.read'],
        }),
      );
    });
  });
});
