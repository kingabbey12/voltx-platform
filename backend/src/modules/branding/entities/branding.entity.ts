import {
  BrandTheme,
  CustomDomain,
  CustomDomainSslStatus,
  CustomDomainVerificationStatus,
} from '@prisma/client';

export interface BrandThemeEntity {
  id: string;
  organizationId: string;
  logoStorageKey: string | null;
  faviconStorageKey: string | null;
  loginBackgroundStorageKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  loginHeadline: string | null;
  loginSubtext: string | null;
  emailTemplateOverrides: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomDomainEntity {
  id: string;
  organizationId: string;
  domain: string;
  verificationToken: string;
  verificationStatus: CustomDomainVerificationStatus;
  sslStatus: CustomDomainSslStatus;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toBrandThemeEntity(record: BrandTheme): BrandThemeEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    logoStorageKey: record.logoStorageKey,
    faviconStorageKey: record.faviconStorageKey,
    loginBackgroundStorageKey: record.loginBackgroundStorageKey,
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    accentColor: record.accentColor,
    loginHeadline: record.loginHeadline,
    loginSubtext: record.loginSubtext,
    emailTemplateOverrides: record.emailTemplateOverrides as Record<string, unknown>,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toCustomDomainEntity(record: CustomDomain): CustomDomainEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    domain: record.domain,
    verificationToken: record.verificationToken,
    verificationStatus: record.verificationStatus,
    sslStatus: record.sslStatus,
    verifiedAt: record.verifiedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
