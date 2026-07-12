import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { CreateIdentityProviderDto } from '../src/modules/identity/dto/identity-provider.dto';
import { IdentityProviderService } from '../src/modules/identity/identity-provider.service';
import { IdentityProviderRepository } from '../src/modules/identity/identity-provider.repository';
import { SamlEngineService } from '../src/modules/identity/saml/saml-engine.service';

describe('IdentityProviderService', () => {
  let service: IdentityProviderService;
  let repository: jest.Mocked<IdentityProviderRepository>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityProviderService,
        {
          provide: IdentityProviderRepository,
          useValue: { create: jest.fn(), findByIdInOrg: jest.fn(), listByOrganization: jest.fn() },
        },
        { provide: EncryptionService, useValue: { encrypt: jest.fn((v: string) => `enc(${v})`) } },
        {
          provide: SamlEngineService,
          useValue: { parseIdpMetadata: jest.fn(), generateSpMetadata: jest.fn() },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(IdentityProviderService);
    repository = module.get(IdentityProviderRepository);
    encryptionService = module.get(EncryptionService);
    tenantContextService = module.get(TenantContextService);
  });

  it('never touches the repository when the caller is not a member of the requested organization', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(
      service.create('org-not-mine', { name: 'Attempted cross-tenant IdP', protocol: 'SAML' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();

    await expect(service.list('org-not-mine')).rejects.toThrow(ForbiddenException);
    expect(repository.listByOrganization).not.toHaveBeenCalled();
  });

  it('rejects creating a SAML provider without samlConfiguration', async () => {
    const dto: CreateIdentityProviderDto = { name: 'Acme SSO', protocol: 'SAML' };
    await expect(service.create('org-1', dto)).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects creating an OIDC provider without oidcConfiguration', async () => {
    const dto: CreateIdentityProviderDto = { name: 'Acme SSO', protocol: 'OIDC' };
    await expect(service.create('org-1', dto)).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a preset/protocol mismatch (e.g. ENTRA_ID, which is OIDC-only, requested with SAML)', async () => {
    const dto: CreateIdentityProviderDto = {
      name: 'Acme SSO',
      protocol: 'SAML',
      preset: 'ENTRA_ID',
      samlConfiguration: {
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'CERTDATA',
      },
    };

    await expect(service.create('org-1', dto)).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('encrypts the IdP certificate before persisting a SAML configuration', async () => {
    repository.create.mockResolvedValue({ id: 'idp-1' } as never);
    const dto: CreateIdentityProviderDto = {
      name: 'Acme SSO',
      protocol: 'SAML',
      samlConfiguration: {
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'PLAINTEXT_CERT',
      },
    };

    await service.create('org-1', dto);

    expect(encryptionService.encrypt).toHaveBeenCalledWith('PLAINTEXT_CERT');
    const createArgs = repository.create.mock.calls[0][0];
    expect(createArgs.samlConfiguration?.idpCertificate).toBe('enc(PLAINTEXT_CERT)');
  });

  it('encrypts the OIDC client secret before persisting', async () => {
    repository.create.mockResolvedValue({ id: 'idp-1' } as never);
    const dto: CreateIdentityProviderDto = {
      name: 'Acme SSO',
      protocol: 'OIDC',
      preset: 'OKTA',
      oidcConfiguration: {
        issuer: 'https://idp.example.com',
        clientId: 'client-1',
        clientSecret: 'PLAINTEXT_SECRET',
      },
    };

    await service.create('org-1', dto);

    expect(encryptionService.encrypt).toHaveBeenCalledWith('PLAINTEXT_SECRET');
    const createArgs = repository.create.mock.calls[0][0];
    expect(createArgs.oidcConfiguration?.clientSecret).toBe('enc(PLAINTEXT_SECRET)');
  });
});
