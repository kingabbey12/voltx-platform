import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { BrandingPublicService } from '../src/modules/branding/branding-public.service';
import { BrandThemeRepository } from '../src/modules/branding/brand-theme.repository';
import { BrandThemeService } from '../src/modules/branding/brand-theme.service';
import { CustomDomainRepository } from '../src/modules/branding/custom-domain.repository';
import { BrandThemeEntity } from '../src/modules/branding/entities/branding.entity';

function makeTheme(overrides: Partial<BrandThemeEntity> = {}): BrandThemeEntity {
  return {
    id: 'theme-1',
    organizationId: 'org-1',
    logoStorageKey: 'branding/org-1/logo.png',
    faviconStorageKey: null,
    loginBackgroundStorageKey: null,
    primaryColor: '#112233',
    secondaryColor: null,
    accentColor: null,
    loginHeadline: 'Welcome',
    loginSubtext: null,
    emailTemplateOverrides: { invitation: { subject: 'secret internal override' } },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BrandingPublicService', () => {
  let service: BrandingPublicService;
  let prisma: { system: { organization: { findFirst: jest.Mock } } };
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let customDomainRepository: jest.Mocked<CustomDomainRepository>;
  let brandThemeRepository: jest.Mocked<BrandThemeRepository>;
  let brandThemeService: jest.Mocked<BrandThemeService>;

  beforeEach(async () => {
    prisma = { system: { organization: { findFirst: jest.fn() } } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingPublicService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationRepository, useValue: { findBySlug: jest.fn() } },
        { provide: CustomDomainRepository, useValue: { findVerifiedByDomain: jest.fn() } },
        { provide: BrandThemeRepository, useValue: { findByOrganizationUnscoped: jest.fn() } },
        { provide: BrandThemeService, useValue: { resolveUrls: jest.fn() } },
      ],
    }).compile();

    service = module.get(BrandingPublicService);
    organizationRepository = module.get(OrganizationRepository);
    customDomainRepository = module.get(CustomDomainRepository);
    brandThemeRepository = module.get(BrandThemeRepository);
    brandThemeService = module.get(BrandThemeService);
  });

  it('resolves by organization slug first', async () => {
    organizationRepository.findBySlug.mockResolvedValue({ id: 'org-1', name: 'Acme' } as never);
    brandThemeRepository.findByOrganizationUnscoped.mockResolvedValue(makeTheme());
    brandThemeService.resolveUrls.mockResolvedValue({
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: null,
      loginBackgroundUrl: null,
    });

    const result = await service.getPublicBranding('acme');

    expect(result.organizationName).toBe('Acme');
    expect(customDomainRepository.findVerifiedByDomain).not.toHaveBeenCalled();
  });

  it('falls back to a verified custom domain when no slug matches', async () => {
    organizationRepository.findBySlug.mockResolvedValue(null);
    customDomainRepository.findVerifiedByDomain.mockResolvedValue({
      organizationId: 'org-2',
    } as never);
    prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-2', name: 'Beta Inc' });
    brandThemeRepository.findByOrganizationUnscoped.mockResolvedValue(null);

    const result = await service.getPublicBranding('app.beta.com');

    expect(result.organizationName).toBe('Beta Inc');
    expect(result.logoUrl).toBeNull();
  });

  it('throws NotFoundException when neither a slug nor a verified domain matches', async () => {
    organizationRepository.findBySlug.mockResolvedValue(null);
    customDomainRepository.findVerifiedByDomain.mockResolvedValue(null);

    await expect(service.getPublicBranding('does-not-exist')).rejects.toThrow(NotFoundException);
  });

  it('never leaks emailTemplateOverrides or any field beyond the public branding DTO', async () => {
    organizationRepository.findBySlug.mockResolvedValue({ id: 'org-1', name: 'Acme' } as never);
    brandThemeRepository.findByOrganizationUnscoped.mockResolvedValue(makeTheme());
    brandThemeService.resolveUrls.mockResolvedValue({
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: null,
      loginBackgroundUrl: null,
    });

    const result = await service.getPublicBranding('acme');

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret internal override');
    expect(Object.keys(result).sort()).toEqual(
      [
        'organizationName',
        'logoUrl',
        'faviconUrl',
        'loginBackgroundUrl',
        'primaryColor',
        'secondaryColor',
        'accentColor',
        'loginHeadline',
        'loginSubtext',
      ].sort(),
    );
  });
});
