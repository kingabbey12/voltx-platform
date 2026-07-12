import { Injectable } from '@nestjs/common';
import { CompanySize, OrganizationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from './entities/organization.entity';
import { toJsonValue, toOrganizationEntity } from './entities/organization.mapper';

export interface CreateOrganizationData {
  name: string;
  slug: string;
  logoUrl?: string;
  email?: string;
  website?: string;
  industry?: string;
  country?: string;
  state?: string;
  city?: string;
  companySize?: CompanySize;
  primaryGoals?: string[];
  currency?: string;
  language?: string;
  phone?: string;
  timezone?: string;
  status?: OrganizationStatus;
  settings?: Record<string, unknown>;
}

export interface UpdateOrganizationData {
  name?: string;
  logoUrl?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  companySize?: CompanySize | null;
  primaryGoals?: string[];
  currency?: string | null;
  language?: string | null;
  phone?: string | null;
  timezone?: string;
  status?: OrganizationStatus;
  settings?: Record<string, unknown>;
}

export interface FindAllOrganizationsParams {
  page: number;
  limit: number;
  status?: OrganizationStatus;
  search?: string;
}

function buildOrganizationSearchWhere(
  status?: OrganizationStatus,
  search?: string,
): Prisma.OrganizationWhereInput {
  return {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export interface PaginatedOrganizations {
  items: OrganizationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class OrganizationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateOrganizationData): Promise<OrganizationEntity> {
    const record = await this.prisma.system.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        logoUrl: data.logoUrl,
        email: data.email,
        website: data.website,
        industry: data.industry,
        country: data.country,
        state: data.state,
        city: data.city,
        companySize: data.companySize,
        primaryGoals: data.primaryGoals ?? [],
        currency: data.currency,
        language: data.language,
        phone: data.phone,
        timezone: data.timezone ?? 'UTC',
        status: data.status ?? OrganizationStatus.ACTIVE,
        settings: toJsonValue(data.settings) ?? {},
      },
    });

    return toOrganizationEntity(record);
  }

  async findById(): Promise<OrganizationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prisma.organization.findFirst({
      where: { id: tenant.organizationId, deletedAt: null },
    });

    return record ? toOrganizationEntity(record) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationEntity | null> {
    const record = await this.prisma.system.organization.findFirst({
      where: { slug, deletedAt: null },
    });

    return record ? toOrganizationEntity(record) : null;
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const record = await this.prisma.system.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    return record !== null;
  }

  async findAll(params: FindAllOrganizationsParams): Promise<PaginatedOrganizations> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;
    const where = buildOrganizationSearchWhere(status, search);

    const [records, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      items: records.map(toOrganizationEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  /**
   * Platform-admin cross-organization search — deliberately queries
   * `this.prisma.system.organization` (unscoped), not `this.prisma.organization`
   * (which findAll above uses): the tenant-scoping Prisma extension would
   * otherwise silently narrow this to just the calling admin's own
   * organization, which is exactly wrong for "search every organization."
   * Used only behind PLATFORM_ADMIN_GUARDS (src/modules/platform/organizations/).
   */
  async searchUnscoped(params: FindAllOrganizationsParams): Promise<PaginatedOrganizations> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;
    const where = buildOrganizationSearchWhere(status, search);

    const [records, total] = await Promise.all([
      this.prisma.system.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.system.organization.count({ where }),
    ]);

    return {
      items: records.map(toOrganizationEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async update(data: UpdateOrganizationData): Promise<OrganizationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.findById();
    if (!existing) {
      return null;
    }

    const updateData: Prisma.OrganizationUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.logoUrl !== undefined) {
      updateData.logoUrl = data.logoUrl;
    }
    if (data.email !== undefined) {
      updateData.email = data.email;
    }
    if (data.website !== undefined) {
      updateData.website = data.website;
    }
    if (data.industry !== undefined) {
      updateData.industry = data.industry;
    }
    if (data.country !== undefined) {
      updateData.country = data.country;
    }
    if (data.state !== undefined) {
      updateData.state = data.state;
    }
    if (data.city !== undefined) {
      updateData.city = data.city;
    }
    if (data.companySize !== undefined) {
      updateData.companySize = data.companySize;
    }
    if (data.primaryGoals !== undefined) {
      updateData.primaryGoals = data.primaryGoals;
    }
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }
    if (data.language !== undefined) {
      updateData.language = data.language;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.settings !== undefined) {
      updateData.settings = toJsonValue(data.settings);
    }

    const record = await this.prisma.system.organization.update({
      where: { id: tenant.organizationId },
      data: updateData,
    });

    return toOrganizationEntity(record);
  }

  async completeOnboarding(): Promise<OrganizationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.findById();
    if (!existing) {
      return null;
    }

    if (existing.onboardingCompletedAt) {
      return existing;
    }

    const record = await this.prisma.system.organization.update({
      where: { id: tenant.organizationId },
      data: { onboardingCompletedAt: new Date() },
    });

    return toOrganizationEntity(record);
  }

  async softDelete(): Promise<OrganizationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.findById();
    if (!existing) {
      return null;
    }

    const record = await this.prisma.system.organization.update({
      where: { id: tenant.organizationId },
      data: { deletedAt: new Date() },
    });

    return toOrganizationEntity(record);
  }
}
