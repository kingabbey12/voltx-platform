import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { LegalHoldRepository } from '../src/modules/compliance/legal-hold/legal-hold.repository';
import { LegalHoldService } from '../src/modules/compliance/legal-hold/legal-hold.service';

describe('LegalHoldService', () => {
  let service: LegalHoldService;
  let repository: jest.Mocked<LegalHoldRepository>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      listByOrganization: jest.fn(),
      findByIdInOrg: jest.fn(),
      update: jest.fn(),
      release: jest.fn(),
      findActiveForUser: jest.fn(),
    } as unknown as jest.Mocked<LegalHoldRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalHoldService,
        { provide: LegalHoldRepository, useValue: repository },
        {
          provide: TenantContextService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue({
              organizationId: 'org-1',
              userId: 'admin-1',
              membershipId: 'm-1',
              requestId: 'req-1',
            }),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(LegalHoldService);
  });

  it("creates a hold scoped to the caller's organization and actor", async () => {
    repository.create.mockResolvedValue({ id: 'hold-1', name: 'Matter A' } as never);

    await service.create({ name: 'Matter A', reason: 'Litigation' });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Matter A',
      reason: 'Litigation',
      organizationId: 'org-1',
      createdBy: 'admin-1',
    });
  });

  it('rejects updating a released hold', async () => {
    repository.findByIdInOrg.mockResolvedValue({ id: 'hold-1', status: 'RELEASED' } as never);
    await expect(service.update('hold-1', { name: 'New name' })).rejects.toThrow(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects releasing an already-released hold', async () => {
    repository.findByIdInOrg.mockResolvedValue({ id: 'hold-1', status: 'RELEASED' } as never);
    await expect(service.release('hold-1')).rejects.toThrow(ConflictException);
    expect(repository.release).not.toHaveBeenCalled();
  });

  it('releases an active hold, recording who released it', async () => {
    repository.findByIdInOrg.mockResolvedValue({ id: 'hold-1', status: 'ACTIVE' } as never);
    repository.release.mockResolvedValue({ id: 'hold-1', status: 'RELEASED' } as never);

    await service.release('hold-1');

    expect(repository.release).toHaveBeenCalledWith('hold-1', 'admin-1');
  });
});
