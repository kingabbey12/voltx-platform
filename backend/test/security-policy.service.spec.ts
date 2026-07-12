import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { SecurityPolicyService } from '../src/modules/security/security-policy.service';

describe('SecurityPolicyService', () => {
  let service: SecurityPolicyService;
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityPolicyService,
        {
          provide: OrganizationRepository,
          useValue: { findById: jest.fn(), update: jest.fn() },
        },
        {
          provide: TenantContextService,
          useValue: { assertOrganizationAccess: jest.fn() },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(SecurityPolicyService);
    organizationRepository = module.get(OrganizationRepository);
    tenantContextService = module.get(TenantContextService);
  });

  it('rejects reading the policy for an org that does not match the JWT-derived tenant', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new Error('Cross-tenant access is forbidden');
    });

    await expect(service.get('other-org-id')).rejects.toThrow('Cross-tenant access is forbidden');
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it('returns the default policy when no security settings have been configured', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      email: null,
      website: null,
      industry: null,
      country: null,
      state: null,
      city: null,
      companySize: null,
      primaryGoals: [],
      currency: null,
      language: null,
      phone: null,
      timezone: 'UTC',
      status: 'ACTIVE' as never,
      settings: {},
      onboardingCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const policy = await service.get('org-1');

    expect(policy).toEqual({
      mfaRequired: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: false,
        requireNumber: false,
        requireSymbol: false,
      },
      ipAllowlist: [],
    });
  });

  it('merges a partial update into settings without clobbering unrelated settings keys', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      email: null,
      website: null,
      industry: null,
      country: null,
      state: null,
      city: null,
      companySize: null,
      primaryGoals: [],
      currency: null,
      language: null,
      phone: null,
      timezone: 'UTC',
      status: 'ACTIVE' as never,
      settings: { onboardingStep: 'welcome' },
      onboardingCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    organizationRepository.update.mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      email: null,
      website: null,
      industry: null,
      country: null,
      state: null,
      city: null,
      companySize: null,
      primaryGoals: [],
      currency: null,
      language: null,
      phone: null,
      timezone: 'UTC',
      status: 'ACTIVE' as never,
      settings: {
        onboardingStep: 'welcome',
        security: {
          mfaRequired: true,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: false,
            requireNumber: false,
            requireSymbol: false,
          },
          ipAllowlist: [],
        },
      },
      onboardingCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const policy = await service.update('org-1', { mfaRequired: true });

    const updateArgs = organizationRepository.update.mock.calls[0][0] as {
      settings: { onboardingStep: string; security: { mfaRequired: boolean } };
    };
    expect(updateArgs.settings.onboardingStep).toBe('welcome');
    expect(updateArgs.settings.security.mfaRequired).toBe(true);
    expect(policy.mfaRequired).toBe(true);
  });
});
