import { Injectable } from '@nestjs/common';
import { OrganizationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationEntity } from './entities/organization.entity';
import { toJsonValue, toOrganizationEntity } from './entities/organization.mapper';

export interface CreateOrganizationData {
  name: string;
  slug: string;
  logoUrl?: string;
  industry?: string;
  country?: string;
  timezone?: string;
  status?: OrganizationStatus;
  settings?: Record<string, unknown>;
}

export interface UpdateOrganizationData {
  name?: string;
  logoUrl?: string | null;
  industry?: string | null;
  country?: string | null;
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

export interface PaginatedOrganizations {
  items: OrganizationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrganizationData): Promise<OrganizationEntity> {
    const record = await this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        logoUrl: data.logoUrl,
        industry: data.industry,
        country: data.country,
        timezone: data.timezone ?? 'UTC',
        status: data.status ?? OrganizationStatus.ACTIVE,
        settings: toJsonValue(data.settings) ?? {},
      },
    });

    return toOrganizationEntity(record);
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    const record = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });

    return record ? toOrganizationEntity(record) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationEntity | null> {
    const record = await this.prisma.organization.findFirst({
      where: { slug, deletedAt: null },
    });

    return record ? toOrganizationEntity(record) : null;
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const record = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    return record !== null;
  }

  async findAll(params: FindAllOrganizationsParams): Promise<PaginatedOrganizations> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
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

    const [records, total] = await this.prisma.$transaction([
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

  async update(id: string, data: UpdateOrganizationData): Promise<OrganizationEntity | null> {
    const existing = await this.findById(id);
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
    if (data.industry !== undefined) {
      updateData.industry = data.industry;
    }
    if (data.country !== undefined) {
      updateData.country = data.country;
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

    const record = await this.prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return toOrganizationEntity(record);
  }

  async softDelete(id: string): Promise<OrganizationEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toOrganizationEntity(record);
  }
}
