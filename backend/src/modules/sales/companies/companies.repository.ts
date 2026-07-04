import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { CompanyEntity, CompanyStatus } from './entities/company.entity';

export interface CreateCompanyData {
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  status?: CompanyStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateCompanyData = Partial<CreateCompanyData>;

export interface FindCompaniesParams {
  page: number;
  limit: number;
  search?: string;
  status?: CompanyStatus;
}

export interface PaginatedCompanies {
  items: CompanyEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CompanyRecord {
  id: string;
  organizationId: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  status: CompanyStatus;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface CompanyClient {
  create(args: {
    data: {
      organizationId: string;
      name: string;
      domain?: string | null;
      website?: string | null;
      industry?: string | null;
      status: CompanyStatus;
      notes?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<CompanyRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CompanyRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<CompanyRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<CompanyRecord>;
}

@Injectable()
export class CompaniesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateCompanyData): Promise<CompanyEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        name: data.name,
        domain: data.domain ?? null,
        website: data.website ?? null,
        industry: data.industry ?? null,
        status: data.status ?? 'PROSPECT',
        notes: data.notes ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });

    return toEntity(record);
  }

  async findById(id: string): Promise<CompanyEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
    });

    return record ? toEntity(record) : null;
  }

  async findAll(params: FindCompaniesParams): Promise<PaginatedCompanies> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { domain: { contains: params.search, mode: 'insensitive' } },
              { industry: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async update(id: string, data: UpdateCompanyData): Promise<CompanyEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.domain !== undefined ? { domain: data.domain || null } : {}),
        ...(data.website !== undefined ? { website: data.website || null } : {}),
        ...(data.industry !== undefined ? { industry: data.industry || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
      },
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<CompanyEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toEntity(record);
  }

  private client(): CompanyClient {
    return (this.prisma.system as unknown as { salesCompany: CompanyClient }).salesCompany;
  }
}

function toEntity(record: CompanyRecord): CompanyEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    domain: record.domain,
    website: record.website,
    industry: record.industry,
    status: record.status,
    notes: record.notes,
    metadata: toObject(record.metadata),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
