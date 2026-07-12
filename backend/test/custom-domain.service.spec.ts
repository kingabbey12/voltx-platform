import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CustomDomainRepository } from '../src/modules/branding/custom-domain.repository';
import { CustomDomainService } from '../src/modules/branding/custom-domain.service';
import { CustomDomainEntity } from '../src/modules/branding/entities/branding.entity';
import * as dnsVerificationUtil from '../src/modules/branding/utils/dns-verification.util';

function makeDomain(overrides: Partial<CustomDomainEntity> = {}): CustomDomainEntity {
  return {
    id: 'domain-1',
    organizationId: 'org-1',
    domain: 'app.example.com',
    verificationToken: 'voltx-domain-verify-abc123',
    verificationStatus: 'PENDING',
    sslStatus: 'PENDING',
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CustomDomainService', () => {
  let service: CustomDomainService;
  let repository: jest.Mocked<CustomDomainRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomDomainService,
        {
          provide: CustomDomainRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrg: jest.fn(),
            markVerified: jest.fn(),
            markFailed: jest.fn(),
            delete: jest.fn(),
          },
        },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(CustomDomainService);
    repository = module.get(CustomDomainRepository);
    tenantContextService = module.get(TenantContextService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never touches the repository when the caller is not a member of the requested organization', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(service.create('org-not-mine', { domain: 'app.example.com' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects registering a domain that is already claimed by another organization', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    repository.create.mockRejectedValue(prismaError);

    await expect(service.create('org-1', { domain: 'app.example.com' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('marks the domain VERIFIED when the DNS TXT record matches', async () => {
    repository.findByIdInOrg.mockResolvedValue(makeDomain());
    jest.spyOn(dnsVerificationUtil, 'verifyDomainOwnership').mockResolvedValue(true);
    repository.markVerified.mockResolvedValue(makeDomain({ verificationStatus: 'VERIFIED' }));

    const result = await service.verify('org-1', 'domain-1');

    expect(repository.markVerified).toHaveBeenCalledWith('domain-1');
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(result.verificationStatus).toBe('VERIFIED');
  });

  it('marks the domain FAILED when the DNS TXT record is absent', async () => {
    repository.findByIdInOrg.mockResolvedValue(makeDomain());
    jest.spyOn(dnsVerificationUtil, 'verifyDomainOwnership').mockResolvedValue(false);
    repository.markFailed.mockResolvedValue(makeDomain({ verificationStatus: 'FAILED' }));

    const result = await service.verify('org-1', 'domain-1');

    expect(repository.markFailed).toHaveBeenCalledWith('domain-1');
    expect(repository.markVerified).not.toHaveBeenCalled();
    expect(result.verificationStatus).toBe('FAILED');
  });

  it('throws NotFoundException for a domain id that does not belong to this organization', async () => {
    repository.findByIdInOrg.mockResolvedValue(null);
    await expect(service.getOrThrow('org-1', 'not-mine')).rejects.toThrow(NotFoundException);
  });
});
