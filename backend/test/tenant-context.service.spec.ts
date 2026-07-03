import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantContextService],
    }).compile();

    service = module.get(TenantContextService);
  });

  it('stores and retrieves tenant context within a request scope', () => {
    service.run(
      {
        organizationId: 'org-id',
        userId: 'user-id',
        membershipId: 'membership-id',
        requestId: 'request-id',
      },
      () => {
        const context = service.getOrThrow();
        expect(context.organizationId).toBe('org-id');
      },
    );
  });

  it('throws when tenant context is incomplete', () => {
    service.run({ requestId: 'request-id' }, () => {
      expect(() => service.getOrThrow()).toThrow(ForbiddenException);
    });
  });

  it('denies cross-tenant organization access', () => {
    service.run(
      {
        organizationId: 'org-a',
        userId: 'user-id',
        membershipId: 'membership-id',
        requestId: 'request-id',
      },
      () => {
        expect(() => service.assertOrganizationAccess('org-b')).toThrow(ForbiddenException);
      },
    );
  });
});
