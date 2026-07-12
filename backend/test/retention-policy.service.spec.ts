import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { RetentionPolicyRepository } from '../src/modules/compliance/retention-policy/retention-policy.repository';
import { RetentionPolicyService } from '../src/modules/compliance/retention-policy/retention-policy.service';

describe('RetentionPolicyService', () => {
  let service: RetentionPolicyService;
  let repository: jest.Mocked<RetentionPolicyRepository>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      listByOrganization: jest.fn(),
      findByIdInOrg: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RetentionPolicyRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionPolicyService,
        { provide: RetentionPolicyRepository, useValue: repository },
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

    service = module.get(RetentionPolicyService);
  });

  it("creates a policy scoped to the caller's organization", async () => {
    repository.create.mockResolvedValue({ id: 'policy-1' } as never);

    await service.create({
      resourceType: 'NOTIFICATION',
      retentionDays: 90,
      action: 'DELETE',
    } as never);

    expect(repository.create).toHaveBeenCalledWith({
      resourceType: 'NOTIFICATION',
      retentionDays: 90,
      action: 'DELETE',
      organizationId: 'org-1',
      createdBy: 'admin-1',
    });
  });

  it('translates a unique-constraint violation (duplicate resourceType) into a 409', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    repository.create.mockRejectedValue(prismaError);

    await expect(
      service.create({
        resourceType: 'NOTIFICATION',
        retentionDays: 90,
        action: 'DELETE',
      } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('rethrows unrelated errors unchanged', async () => {
    repository.create.mockRejectedValue(new Error('unexpected'));
    await expect(
      service.create({
        resourceType: 'NOTIFICATION',
        retentionDays: 90,
        action: 'DELETE',
      } as never),
    ).rejects.toThrow('unexpected');
  });
});
