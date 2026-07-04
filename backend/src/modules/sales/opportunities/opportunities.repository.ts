import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { OpportunityEntity, OpportunityStage } from './entities/opportunity.entity';

export interface CreateOpportunityData {
  companyId?: string;
  contactId?: string;
  leadId?: string;
  title: string;
  stage?: OpportunityStage;
  amount?: number;
  currency?: string;
  probability?: number;
  expectedCloseAt?: Date | null;
  insights?: string | null;
  nextBestAction?: string | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateOpportunityData = Partial<CreateOpportunityData>;

export interface FindOpportunitiesParams {
  page: number;
  limit: number;
  search?: string;
  stage?: OpportunityStage;
  companyId?: string;
  contactId?: string;
  leadId?: string;
}

export interface PaginatedOpportunities {
  items: OpportunityEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OpportunityRecord {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  title: string;
  stage: OpportunityStage;
  amount: number | null;
  currency: string;
  probability: number;
  expectedCloseAt: Date | null;
  insights: string | null;
  nextBestAction: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface OpportunityClient {
  create(args: {
    data: {
      organizationId: string;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      title: string;
      stage: OpportunityStage;
      amount?: number | null;
      currency: string;
      probability: number;
      expectedCloseAt?: Date | null;
      insights?: string | null;
      nextBestAction?: string | null;
      notes?: string | null;
      metadata: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<OpportunityRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<OpportunityRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<OpportunityRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<OpportunityRecord>;
}

@Injectable()
export class OpportunitiesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateOpportunityData): Promise<OpportunityEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        companyId: data.companyId ?? null,
        contactId: data.contactId ?? null,
        leadId: data.leadId ?? null,
        title: data.title,
        stage: data.stage ?? 'DISCOVERY',
        amount: data.amount ?? null,
        currency: data.currency ?? 'USD',
        probability: data.probability ?? 0,
        expectedCloseAt: data.expectedCloseAt ?? null,
        insights: data.insights ?? null,
        nextBestAction: data.nextBestAction ?? null,
        notes: data.notes ?? null,
        metadata: toJsonValue(data.metadata) ?? {},
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<OpportunityEntity | null> {
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

  async findAll(params: FindOpportunitiesParams): Promise<PaginatedOpportunities> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.stage ? { stage: params.stage } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.contactId ? { contactId: params.contactId } : {}),
      ...(params.leadId ? { leadId: params.leadId } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
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

  async update(id: string, data: UpdateOpportunityData): Promise<OpportunityEntity | null> {
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
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.stage !== undefined ? { stage: data.stage } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.probability !== undefined ? { probability: data.probability } : {}),
        ...(data.expectedCloseAt !== undefined ? { expectedCloseAt: data.expectedCloseAt } : {}),
        ...(data.insights !== undefined ? { insights: data.insights } : {}),
        ...(data.nextBestAction !== undefined ? { nextBestAction: data.nextBestAction } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) ?? {} } : {}),
      },
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<OpportunityEntity | null> {
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

  private client(): OpportunityClient {
    return (this.prisma.system as unknown as { salesOpportunity: OpportunityClient })
      .salesOpportunity;
  }
}

function toEntity(record: OpportunityRecord): OpportunityEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    companyId: record.companyId,
    contactId: record.contactId,
    leadId: record.leadId,
    title: record.title,
    stage: record.stage,
    amount: record.amount,
    currency: record.currency,
    probability: record.probability,
    expectedCloseAt: record.expectedCloseAt,
    insights: record.insights,
    nextBestAction: record.nextBestAction,
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
