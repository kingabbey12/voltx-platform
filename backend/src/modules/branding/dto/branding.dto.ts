import {
  IsHexColor,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CustomDomainSslStatus, CustomDomainVerificationStatus } from '@prisma/client';
import { BrandThemeEntity, CustomDomainEntity } from '../entities/branding.entity';

export class UpdateBrandThemeDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  loginHeadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  loginSubtext?: string;

  @IsOptional()
  @IsObject()
  emailTemplateOverrides?: Record<string, unknown>;
}

/** A domain name — deliberately not validated as a full RFC 1035 grammar, just enough to reject obvious garbage. */
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export class CreateCustomDomainDto {
  @IsString()
  @Matches(DOMAIN_PATTERN, { message: 'domain must be a valid hostname (e.g. app.example.com)' })
  @MinLength(3)
  @MaxLength(255)
  domain!: string;
}

export class BrandThemeResponseDto {
  logoUrl!: string | null;
  faviconUrl!: string | null;
  loginBackgroundUrl!: string | null;
  primaryColor!: string | null;
  secondaryColor!: string | null;
  accentColor!: string | null;
  loginHeadline!: string | null;
  loginSubtext!: string | null;
  emailTemplateOverrides!: Record<string, unknown>;
  updatedAt!: string;

  static fromEntity(
    entity: BrandThemeEntity,
    urls: { logoUrl: string | null; faviconUrl: string | null; loginBackgroundUrl: string | null },
  ): BrandThemeResponseDto {
    const dto = new BrandThemeResponseDto();
    dto.logoUrl = urls.logoUrl;
    dto.faviconUrl = urls.faviconUrl;
    dto.loginBackgroundUrl = urls.loginBackgroundUrl;
    dto.primaryColor = entity.primaryColor;
    dto.secondaryColor = entity.secondaryColor;
    dto.accentColor = entity.accentColor;
    dto.loginHeadline = entity.loginHeadline;
    dto.loginSubtext = entity.loginSubtext;
    dto.emailTemplateOverrides = entity.emailTemplateOverrides;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

/** The ONLY branding fields ever exposed publicly/unauthenticated — deliberately excludes emailTemplateOverrides, organizationId, and every other org field. */
export class PublicBrandingResponseDto {
  organizationName!: string;
  logoUrl!: string | null;
  faviconUrl!: string | null;
  loginBackgroundUrl!: string | null;
  primaryColor!: string | null;
  secondaryColor!: string | null;
  accentColor!: string | null;
  loginHeadline!: string | null;
  loginSubtext!: string | null;
}

export class CustomDomainResponseDto {
  id!: string;
  domain!: string;
  verificationStatus!: CustomDomainVerificationStatus;
  sslStatus!: CustomDomainSslStatus;
  verificationToken!: string;
  verifiedAt!: string | null;
  createdAt!: string;

  static fromEntity(entity: CustomDomainEntity): CustomDomainResponseDto {
    const dto = new CustomDomainResponseDto();
    dto.id = entity.id;
    dto.domain = entity.domain;
    dto.verificationStatus = entity.verificationStatus;
    dto.sslStatus = entity.sslStatus;
    dto.verificationToken = entity.verificationToken;
    dto.verifiedAt = entity.verifiedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
