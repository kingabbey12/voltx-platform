import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { ActivityEntity, ActivityType } from './entities/activity.entity';

export interface CreateActivityData {
  companyId?: string;
  contactId?: string;
  leadId?: string;
  opportunityId?: string;
  type: ActivityType;
  subject: string;
  description?: string;
  occurredAt?: Date | null;
  dueAt?: Date | null;
  completed?: boolean;
  meetingSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export type UpdateActivityData = Partial<CreateActivityData>;

export interface FindActivitiesParams {
  page: number;
  limit: number;
  search?: string;
  type?: ActivityType;
  completed?: boolean;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  opportunityId?: string;
}

export interface PaginatedActivities {
  items: ActivityEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ActivityRecord {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  type: ActivityType;
  subject: string;
  description: string | null;
  occurredAt: Date | null;
  dueAt: Date | null;
  completed: boolean;
  meetingSummary: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface ActivityClient {
  create(args: {
    data: {
      organizationId: string;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      opportunityId?: string | null;
      type: ActivityType;
      subject: string;
      description?: string | null;
      occurredAt?: Date | null;
      dueAt?: Date | null;
      completed: boolean;
      meetingSummary?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<ActivityRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<ActivityRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<ActivityRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ActivityRecord>;
}

@Injectable()
export class ActivitiesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateActivityData): Promise<ActivityEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        companyId: data.companyId ?? null,
        contactId: data.contactId ?? null,
        leadId: data.leadId ?? null,
        opportunityId: data.opportunityId ?? null,
        type: data.type,
        subject: data.subject,
        description: data.description ?? null,
        occurredAt: data.occurredAt ?? null,
        dueAt: data.dueAt ?? null,
        completed: data.completed ?? false,
        meetingSummary: data.meetingSummary ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<ActivityEntity | null> {
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

  async findAll(params: FindActivitiesParams): Promise<PaginatedActivities> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.type ? { type: params.type } : {}),
      ...(params.completed !== undefined ? { completed: params.completed } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.contactId ? { contactId: params.contactId } : {}),
      ...(params.leadId ? { leadId: params.leadId } : {}),
      ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      ...(params.search
        ? {
            OR: [
              { subject: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
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

  async update(id: string, data: UpdateActivityData): Promise<ActivityEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.companyId !== undefined ? { companyId: data.companyId || null } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId || null } : {}),
        ...(data.leadId !== undefined ? { leadId: data.leadId || null } : {}),
        ...(data.opportunityId !== undefined ? { opportunityId: data.opportunityId || null } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
        ...(data.completed !== undefined ? { completed: data.completed } : {}),
        ...(data.meetingSummary !== undefined ? { meetingSummary: data.meetingSummary } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
      },
    });
    return toEntity(record);
  }

  async softDelete(id: string): Promise<ActivityEntity | null> {
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

  private client(): ActivityClient {
    return (this.prisma.system as unknown as { salesActivity: ActivityClient }).salesActivity;
  }
}

function toEntity(record: ActivityRecord): ActivityEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    companyId: record.companyId,
    contactId: record.contactId,
    leadId: record.leadId,
    opportunityId: record.opportunityId,
    type: record.type,
    subject: record.subject,
    description: record.description,
    occurredAt: record.occurredAt,
    dueAt: record.dueAt,
    completed: record.completed,
    meetingSummary: record.meetingSummary,
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
