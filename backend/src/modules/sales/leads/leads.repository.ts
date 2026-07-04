import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { LeadEntity, LeadStatus } from './entities/lead.entity';

export interface CreateLeadData {
  companyId?: string;
  contactId?: string;
  title: string;
  source?: string;
  status?: LeadStatus;
  qualificationScore?: number | null;
  qualificationSummary?: string | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateLeadData = Partial<CreateLeadData>;

export interface FindLeadsParams {
  page: number;
  limit: number;
  search?: string;
  status?: LeadStatus;
  companyId?: string;
  contactId?: string;
}

export interface PaginatedLeads {
  items: LeadEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LeadRecord {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  title: string;
  source: string | null;
  status: LeadStatus;
  qualificationScore: number | null;
  qualificationSummary: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface LeadClient {
  create(args: {
    data: {
      organizationId: string;
      companyId?: string | null;
      contactId?: string | null;
      title: string;
      source?: string | null;
      status: LeadStatus;
      qualificationScore?: number | null;
      qualificationSummary?: string | null;
      notes?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<LeadRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<LeadRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<LeadRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<LeadRecord>;
}

@Injectable()
export class LeadsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateLeadData): Promise<LeadEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        companyId: data.companyId ?? null,
        contactId: data.contactId ?? null,
        title: data.title,
        source: data.source ?? null,
        status: data.status ?? 'NEW',
        qualificationScore: data.qualificationScore ?? null,
        qualificationSummary: data.qualificationSummary ?? null,
        notes: data.notes ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });

    return toEntity(record);
  }

  async findById(id: string): Promise<LeadEntity | null> {
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

  async findAll(params: FindLeadsParams): Promise<PaginatedLeads> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.contactId ? { contactId: params.contactId } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
              { source: { contains: params.search, mode: 'insensitive' } },
              { notes: { contains: params.search, mode: 'insensitive' } },
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

  async update(id: string, data: UpdateLeadData): Promise<LeadEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.companyId !== undefined ? { companyId: data.companyId || null } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId || null } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.source !== undefined ? { source: data.source || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.qualificationScore !== undefined
          ? { qualificationScore: data.qualificationScore }
          : {}),
        ...(data.qualificationSummary !== undefined
          ? { qualificationSummary: data.qualificationSummary }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
      },
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<LeadEntity | null> {
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

  private client(): LeadClient {
    return (this.prisma.system as unknown as { salesLead: LeadClient }).salesLead;
  }
}

function toEntity(record: LeadRecord): LeadEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    companyId: record.companyId,
    contactId: record.contactId,
    title: record.title,
    source: record.source,
    status: record.status,
    qualificationScore: record.qualificationScore,
    qualificationSummary: record.qualificationSummary,
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
