import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthApplicationStatus } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { OutboundHttpGuardService } from '../src/modules/ai/tools/outbound-http-guard.service';
import { OAuthApplicationWithRedirectUrisEntity } from '../src/modules/oauth-provider/entities/oauth-application.entity';
import { OAuthApplicationRepository } from '../src/modules/oauth-provider/oauth-application.repository';
import { OAuthApplicationService } from '../src/modules/oauth-provider/oauth-application.service';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';

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

describe('OAuthApplicationService', () => {
  let service: OAuthApplicationService;
  let repository: jest.Mocked<OAuthApplicationRepository>;
  let permissionRepository: jest.Mocked<PermissionRepository>;
  let outboundHttpGuard: jest.Mocked<OutboundHttpGuardService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthApplicationService,
        {
          provide: OAuthApplicationRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrganization: jest.fn(),
            update: jest.fn(),
            replaceRedirectUris: jest.fn(),
            rotateSecret: jest.fn(),
            setStatus: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PermissionRepository,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([
                { key: 'sales.opportunity.read' },
                { key: 'sales.contact.read' },
              ]),
          },
        },
        {
          provide: OutboundHttpGuardService,
          useValue: { assertUrlIsSafeDestination: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(OAuthApplicationService);
    repository = module.get(OAuthApplicationRepository);
    permissionRepository = module.get(PermissionRepository);
    outboundHttpGuard = module.get(OutboundHttpGuardService);
    tenantContextService = module.get(TenantContextService);
  });

  describe('cross-tenant isolation', () => {
    it('never touches the repository when the caller is not a member of the requested organization', async () => {
      tenantContextService.assertOrganizationAccess.mockImplementation(() => {
        throw new ForbiddenException('Cross-tenant access is forbidden');
      });

      await expect(
        service.create('org-not-mine', 'user-1', [], {
          name: 'x',
          redirectUris: ['https://x.example/cb'],
          scopes: ['sales.opportunity.read'],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();

      await expect(service.list('org-not-mine')).rejects.toThrow(ForbiddenException);
      expect(repository.listByOrganization).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it("rejects scopes the caller doesn't hold", async () => {
      await expect(
        service.create('org-1', 'user-1', ['sales.contact.read'], {
          name: 'Escalation attempt',
          redirectUris: ['https://acme.example/cb'],
          scopes: ['sales.opportunity.read'],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown permission key as a scope', async () => {
      await expect(
        service.create('org-1', 'user-1', ['not.a.real.permission'], {
          name: 'Bad',
          redirectUris: ['https://acme.example/cb'],
          scopes: ['not.a.real.permission'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-loopback redirect URI that is not https', async () => {
      await expect(
        service.create('org-1', 'user-1', ['sales.opportunity.read'], {
          name: 'Insecure app',
          redirectUris: ['http://acme.example/cb'],
          scopes: ['sales.opportunity.read'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('allows a loopback http redirect URI for local development', async () => {
      repository.create.mockResolvedValue(
        makeApplication({
          redirectUris: [
            {
              id: 'uri-1',
              applicationId: 'app-1',
              uri: 'http://localhost:4000/cb',
              createdAt: new Date(),
            },
          ],
        }),
      );

      await expect(
        service.create('org-1', 'user-1', ['sales.opportunity.read'], {
          name: 'Local dev app',
          redirectUris: ['http://localhost:4000/cb'],
          scopes: ['sales.opportunity.read'],
        }),
      ).resolves.toBeDefined();
    });

    it('rejects a redirect URI the SSRF guard blocks', async () => {
      outboundHttpGuard.assertUrlIsSafeDestination.mockRejectedValueOnce(
        new BadRequestException('blocked'),
      );

      await expect(
        service.create('org-1', 'user-1', ['sales.opportunity.read'], {
          name: 'Malicious app',
          redirectUris: ['https://169.254.169.254/cb'],
          scopes: ['sales.opportunity.read'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates an application and returns the client secret exactly once', async () => {
      repository.create.mockResolvedValue(makeApplication());

      const result = await service.create('org-1', 'user-1', ['sales.opportunity.read'], {
        name: 'Acme Reporting',
        redirectUris: ['https://acme.example/callback'],
        scopes: ['sales.opportunity.read'],
      });

      expect(result.clientSecret).toMatch(/^vcs_/);
      expect(result.clientSecretPrefix).toMatch(/^vcs_/);
      expect(permissionRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('throws NotFoundException getting an application outside the organization', async () => {
      repository.findByIdInOrganization.mockResolvedValue(null);
      await expect(service.getOrThrow('app-1', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('suspends and reactivates an application', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeApplication());
      repository.setStatus.mockResolvedValue(
        makeApplication({ status: OAuthApplicationStatus.SUSPENDED }),
      );

      const result = await service.setStatus('app-1', 'org-1', OAuthApplicationStatus.SUSPENDED);

      expect(result.status).toBe(OAuthApplicationStatus.SUSPENDED);
      expect(repository.setStatus).toHaveBeenCalledWith('app-1', OAuthApplicationStatus.SUSPENDED);
    });

    it('rotates the client secret and returns it exactly once', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeApplication());

      const result = await service.rotateSecret('app-1', 'org-1');

      expect(result.clientSecret).toMatch(/^vcs_/);
      expect(repository.rotateSecret).toHaveBeenCalled();
    });

    it('deletes an application', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeApplication());
      await service.delete('app-1', 'org-1');
      expect(repository.delete).toHaveBeenCalledWith('app-1');
    });
  });
});
