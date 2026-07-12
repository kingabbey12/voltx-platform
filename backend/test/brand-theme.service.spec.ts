import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CACHE_SERVICE, CacheService } from '../src/modules/cache/cache.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../src/modules/attachments/storage/storage-provider.interface';
import { BrandThemeRepository } from '../src/modules/branding/brand-theme.repository';
import { BrandThemeService } from '../src/modules/branding/brand-theme.service';
import { BrandThemeEntity } from '../src/modules/branding/entities/branding.entity';

function makeTheme(overrides: Partial<BrandThemeEntity> = {}): BrandThemeEntity {
  return {
    id: 'theme-1',
    organizationId: 'org-1',
    logoStorageKey: null,
    faviconStorageKey: null,
    loginBackgroundStorageKey: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    loginHeadline: null,
    loginSubtext: null,
    emailTemplateOverrides: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BrandThemeService', () => {
  let service: BrandThemeService;
  let repository: jest.Mocked<BrandThemeRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let storageProvider: jest.Mocked<StorageProvider>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandThemeService,
        {
          provide: BrandThemeRepository,
          useValue: { findByOrganization: jest.fn(), upsert: jest.fn() },
        },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: STORAGE_PROVIDER,
          useValue: {
            upload: jest.fn(),
            delete: jest.fn(),
            getSignedDownloadUrl: jest.fn(),
          },
        },
        {
          provide: CACHE_SERVICE,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            invalidateKey: jest.fn(),
            invalidateTag: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BrandThemeService);
    repository = module.get(BrandThemeRepository);
    tenantContextService = module.get(TenantContextService);
    storageProvider = module.get(STORAGE_PROVIDER);
    cacheService = module.get(CACHE_SERVICE);
  });

  it('returns a null-safe default theme when none exists yet', async () => {
    repository.findByOrganization.mockResolvedValue(null);
    const theme = await service.getOrDefault('org-1');
    expect(theme.organizationId).toBe('org-1');
    expect(theme.primaryColor).toBeNull();
    expect(cacheService.set).toHaveBeenCalledWith('brand-theme:org-1', theme, expect.any(Number), [
      'brand-theme:org-1',
    ]);
  });

  it('returns the cached theme without touching the repository on a cache hit', async () => {
    const cachedTheme = makeTheme();
    cacheService.get.mockResolvedValue(cachedTheme);

    const theme = await service.getOrDefault('org-1');

    expect(theme).toBe(cachedTheme);
    expect(repository.findByOrganization).not.toHaveBeenCalled();
  });

  it('invalidates the cache tag on update', async () => {
    repository.upsert.mockResolvedValue(makeTheme({ primaryColor: '#112233' }));

    await service.update('org-1', { primaryColor: '#112233' });

    expect(cacheService.invalidateTag).toHaveBeenCalledWith('brand-theme:org-1');
  });

  it('never touches the repository when the caller is not a member of the requested organization', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(service.getOrDefault('org-not-mine')).rejects.toThrow(ForbiddenException);
    expect(repository.findByOrganization).not.toHaveBeenCalled();
  });

  it('rejects a logo upload with an unsupported mime type', async () => {
    await expect(
      service.uploadAsset('org-1', 'logo', {
        buffer: Buffer.from('data'),
        mimetype: 'application/pdf',
        size: 100,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it('rejects a logo upload that exceeds the size limit', async () => {
    await expect(
      service.uploadAsset('org-1', 'logo', {
        buffer: Buffer.from('data'),
        mimetype: 'image/png',
        size: 10 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it('rejects a favicon upload with a generic image mime type not in the favicon allowlist', async () => {
    await expect(
      service.uploadAsset('org-1', 'favicon', {
        buffer: Buffer.from('data'),
        mimetype: 'image/webp',
        size: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploads a valid logo, stores the new key, and deletes the previous asset', async () => {
    repository.findByOrganization.mockResolvedValue(
      makeTheme({ logoStorageKey: 'branding/org-1/logo-old.png' }),
    );
    repository.upsert.mockResolvedValue(
      makeTheme({ logoStorageKey: 'branding/org-1/logo-new.png' }),
    );
    storageProvider.delete.mockResolvedValue(undefined);

    await service.uploadAsset('org-1', 'logo', {
      buffer: Buffer.from('data'),
      mimetype: 'image/png',
      size: 100,
    });

    expect(storageProvider.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^branding\/org-1\/logo-.+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(storageProvider.delete).toHaveBeenCalledWith('branding/org-1/logo-old.png');
    expect(cacheService.invalidateTag).toHaveBeenCalledWith('brand-theme:org-1');
  });

  it('resolves signed URLs only for the assets that are actually configured', async () => {
    storageProvider.getSignedDownloadUrl.mockResolvedValue('https://cdn.example.com/signed');
    const theme = makeTheme({ logoStorageKey: 'branding/org-1/logo.png', faviconStorageKey: null });

    const urls = await service.resolveUrls(theme);

    expect(urls.logoUrl).toBe('https://cdn.example.com/signed');
    expect(urls.faviconUrl).toBeNull();
    expect(storageProvider.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
  });
});
