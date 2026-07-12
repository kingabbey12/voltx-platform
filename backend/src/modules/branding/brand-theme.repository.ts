import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BrandThemeEntity, toBrandThemeEntity } from './entities/branding.entity';

export interface UpsertBrandThemeData {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  loginHeadline?: string;
  loginSubtext?: string;
  emailTemplateOverrides?: Record<string, unknown>;
  logoStorageKey?: string | null;
  faviconStorageKey?: string | null;
  loginBackgroundStorageKey?: string | null;
}

@Injectable()
export class BrandThemeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganization(organizationId: string): Promise<BrandThemeEntity | null> {
    const record = await this.prisma.brandTheme.findUnique({ where: { organizationId } });
    return record ? toBrandThemeEntity(record) : null;
  }

  /** Unscoped — used by the public branding endpoint, which resolves the organization first (by slug or verified custom domain) before reading its theme. */
  async findByOrganizationUnscoped(organizationId: string): Promise<BrandThemeEntity | null> {
    return this.findByOrganization(organizationId);
  }

  async upsert(organizationId: string, data: UpsertBrandThemeData): Promise<BrandThemeEntity> {
    const record = await this.prisma.brandTheme.upsert({
      where: { organizationId },
      create: {
        organizationId,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        loginHeadline: data.loginHeadline,
        loginSubtext: data.loginSubtext,
        emailTemplateOverrides: (data.emailTemplateOverrides ?? {}) as Prisma.InputJsonValue,
        logoStorageKey: data.logoStorageKey,
        faviconStorageKey: data.faviconStorageKey,
        loginBackgroundStorageKey: data.loginBackgroundStorageKey,
      },
      update: {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        loginHeadline: data.loginHeadline,
        loginSubtext: data.loginSubtext,
        emailTemplateOverrides: data.emailTemplateOverrides
          ? (data.emailTemplateOverrides as Prisma.InputJsonValue)
          : undefined,
        logoStorageKey: data.logoStorageKey,
        faviconStorageKey: data.faviconStorageKey,
        loginBackgroundStorageKey: data.loginBackgroundStorageKey,
      },
    });
    return toBrandThemeEntity(record);
  }
}
