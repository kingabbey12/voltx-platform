import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../attachments/storage/storage-provider.interface';
import { UpdateBrandThemeDto } from './dto/branding.dto';
import { BrandThemeEntity } from './entities/branding.entity';
import { BrandThemeRepository } from './brand-theme.repository';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 1 day — regenerated fresh on every read, never stored.
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);
const ALLOWED_FAVICON_MIME_TYPES = new Set([
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export type BrandAsset = 'logo' | 'favicon' | 'loginBackground';

export interface BrandThemeUrls {
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
}

@Injectable()
export class BrandThemeService {
  constructor(
    private readonly repository: BrandThemeRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async getOrDefault(organizationId: string): Promise<BrandThemeEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByOrganization(organizationId);
    return existing ?? this.defaultEntity(organizationId);
  }

  async update(organizationId: string, dto: UpdateBrandThemeDto): Promise<BrandThemeEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.upsert(organizationId, dto);
    await this.auditService.record({
      action: 'update',
      resource: 'brand_theme',
      resourceId: entity.id,
      metadata: { organizationId },
    });
    return entity;
  }

  async uploadAsset(
    organizationId: string,
    asset: BrandAsset,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<BrandThemeEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const allowedTypes =
      asset === 'favicon' ? ALLOWED_FAVICON_MIME_TYPES : ALLOWED_IMAGE_MIME_TYPES;
    if (!allowedTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type for ${asset}: ${file.mimetype}. Allowed: ${[...allowedTypes].join(', ')}`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large for ${asset}: ${file.size} bytes (max ${MAX_IMAGE_SIZE_BYTES})`,
      );
    }

    const existing = await this.repository.findByOrganization(organizationId);
    const extension = file.mimetype.split('/')[1]?.replace('svg+xml', 'svg') ?? 'bin';
    const storageKey = `branding/${organizationId}/${asset}-${randomUUID()}.${extension}`;

    await this.storageProvider.upload(storageKey, file.buffer, file.mimetype);

    const previousKey = this.getStorageKeyForAsset(existing, asset);
    const entity = await this.repository.upsert(organizationId, {
      [this.storageFieldForAsset(asset)]: storageKey,
    });

    if (previousKey) {
      await this.storageProvider.delete(previousKey).catch(() => undefined);
    }

    await this.auditService.record({
      action: 'upload_asset',
      resource: 'brand_theme',
      resourceId: entity.id,
      metadata: { organizationId, asset },
    });

    return entity;
  }

  async resolveUrls(entity: BrandThemeEntity): Promise<BrandThemeUrls> {
    const [logoUrl, faviconUrl, loginBackgroundUrl] = await Promise.all([
      this.signIfPresent(entity.logoStorageKey),
      this.signIfPresent(entity.faviconStorageKey),
      this.signIfPresent(entity.loginBackgroundStorageKey),
    ]);
    return { logoUrl, faviconUrl, loginBackgroundUrl };
  }

  private async signIfPresent(storageKey: string | null): Promise<string | null> {
    if (!storageKey) {
      return null;
    }
    return this.storageProvider.getSignedDownloadUrl(storageKey, SIGNED_URL_TTL_SECONDS);
  }

  private getStorageKeyForAsset(entity: BrandThemeEntity | null, asset: BrandAsset): string | null {
    if (!entity) return null;
    switch (asset) {
      case 'logo':
        return entity.logoStorageKey;
      case 'favicon':
        return entity.faviconStorageKey;
      case 'loginBackground':
        return entity.loginBackgroundStorageKey;
    }
  }

  private storageFieldForAsset(
    asset: BrandAsset,
  ): 'logoStorageKey' | 'faviconStorageKey' | 'loginBackgroundStorageKey' {
    switch (asset) {
      case 'logo':
        return 'logoStorageKey';
      case 'favicon':
        return 'faviconStorageKey';
      case 'loginBackground':
        return 'loginBackgroundStorageKey';
    }
  }

  private defaultEntity(organizationId: string): BrandThemeEntity {
    return {
      id: '',
      organizationId,
      logoStorageKey: null,
      faviconStorageKey: null,
      loginBackgroundStorageKey: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      loginHeadline: null,
      loginSubtext: null,
      emailTemplateOverrides: {},
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }
}
