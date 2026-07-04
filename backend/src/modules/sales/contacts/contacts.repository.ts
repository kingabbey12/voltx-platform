import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { ContactEntity } from './entities/contact.entity';

export interface CreateContactData {
  companyId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateContactData = Partial<CreateContactData>;

export interface FindContactsParams {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
}

export interface PaginatedContacts {
  items: ContactEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ContactRecord {
  id: string;
  organizationId: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface ContactClient {
  create(args: {
    data: {
      organizationId: string;
      companyId?: string | null;
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      notes?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<ContactRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<ContactRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<ContactRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ContactRecord>;
}

@Injectable()
export class ContactsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateContactData): Promise<ContactEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        companyId: data.companyId ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        jobTitle: data.jobTitle ?? null,
        notes: data.notes ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<ContactEntity | null> {
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

  async findAll(params: FindContactsParams): Promise<PaginatedContacts> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { jobTitle: { contains: params.search, mode: 'insensitive' } },
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

  async update(id: string, data: UpdateContactData): Promise<ContactEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.companyId !== undefined ? { companyId: data.companyId || null } : {}),
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
      },
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<ContactEntity | null> {
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

  private client(): ContactClient {
    return (this.prisma.system as unknown as { salesContact: ContactClient }).salesContact;
  }
}

function toEntity(record: ContactRecord): ContactEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    companyId: record.companyId,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    jobTitle: record.jobTitle,
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
