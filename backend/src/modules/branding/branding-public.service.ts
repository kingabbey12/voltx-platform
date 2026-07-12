import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRepository } from '../organization/organization.repository';
import { BrandThemeRepository } from './brand-theme.repository';
import { BrandThemeService } from './brand-theme.service';
import { CustomDomainRepository } from './custom-domain.repository';
import { PublicBrandingResponseDto } from './dto/branding.dto';

@Injectable()
export class BrandingPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly customDomainRepository: CustomDomainRepository,
    private readonly brandThemeRepository: BrandThemeRepository,
    private readonly brandThemeService: BrandThemeService,
  ) {}

  /**
   * Resolves `orgSlugOrDomain` to an organization (by slug first, then by
   * a VERIFIED custom domain) and returns ONLY the public-safe subset of
   * its branding — never the full organization record, never
   * emailTemplateOverrides, never anything from any other module. This is
   * the one unauthenticated endpoint in the whole branding surface, so the
   * response shape (PublicBrandingResponseDto) is the data-leakage
   * boundary — extend it deliberately, not by widening what's queried here.
   */
  async getPublicBranding(orgSlugOrDomain: string): Promise<PublicBrandingResponseDto> {
    const organization = await this.resolveOrganization(orgSlugOrDomain);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const theme = await this.brandThemeRepository.findByOrganizationUnscoped(organization.id);
    const urls = theme
      ? await this.brandThemeService.resolveUrls(theme)
      : { logoUrl: null, faviconUrl: null, loginBackgroundUrl: null };

    const dto = new PublicBrandingResponseDto();
    dto.organizationName = organization.name;
    dto.logoUrl = urls.logoUrl;
    dto.faviconUrl = urls.faviconUrl;
    dto.loginBackgroundUrl = urls.loginBackgroundUrl;
    dto.primaryColor = theme?.primaryColor ?? null;
    dto.secondaryColor = theme?.secondaryColor ?? null;
    dto.accentColor = theme?.accentColor ?? null;
    dto.loginHeadline = theme?.loginHeadline ?? null;
    dto.loginSubtext = theme?.loginSubtext ?? null;
    return dto;
  }

  private async resolveOrganization(
    orgSlugOrDomain: string,
  ): Promise<{ id: string; name: string } | null> {
    const bySlug = await this.organizationRepository.findBySlug(orgSlugOrDomain);
    if (bySlug) {
      return bySlug;
    }

    const byDomain = await this.customDomainRepository.findVerifiedByDomain(
      orgSlugOrDomain.toLowerCase(),
    );
    if (!byDomain) {
      return null;
    }
    return this.prisma.system.organization.findFirst({
      where: { id: byDomain.organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
  }
}
