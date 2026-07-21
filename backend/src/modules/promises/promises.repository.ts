import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  PromiseEntity,
  PromiseEventEntity,
  PromiseEventType,
  PromisePartyEntity,
  PromisePartyRole,
  PromiseStatus,
} from './entities/promise.entity';

export interface CreatePromiseData {
  title: string;
  ownerId: string;
  dueAt?: Date | null;
  parties: Array<{ role: PromisePartyRole; contactId?: string; userId?: string }>;
}

export interface UpdatePromiseData {
  title?: string;
  ownerId?: string;
  dueAt?: Date | null;
  parties?: Array<{ role: PromisePartyRole; contactId?: string; userId?: string }>;
}

export interface FindPromisesParams {
  page: number;
  limit: number;
  status?: PromiseStatus;
  ownerId?: string;
  contactId?: string;
  contactIds?: string[];
  search?: string;
}

export interface PaginatedPromises {
  items: PromiseEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PromisePartyRecord {
  id: string;
  promiseId: string;
  role: PromisePartyRole;
  contactId: string | null;
  userId: string | null;
  createdAt: Date;
}

interface PromiseRecord {
  id: string;
  organizationId: string;
  title: string;
  status: PromiseStatus;
  ownerId: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  parties: PromisePartyRecord[];
}

interface PromiseEventRecord {
  id: string;
  promiseId: string;
  type: PromiseEventType;
  actorId: string | null;
  payload: Prisma.JsonValue;
  occurredAt: Date;
}

const PARTIES_INCLUDE = { parties: true } as const;

interface PromiseClient {
  create(args: {
    data: {
      organizationId: string;
      title: string;
      ownerId: string;
      dueAt?: Date | null;
      parties: {
        create: Array<{
          organizationId: string;
          role: PromisePartyRole;
          contactId?: string;
          userId?: string;
        }>;
      };
    };
    include: typeof PARTIES_INCLUDE;
  }): Promise<PromiseRecord>;
  findFirst(args: {
    where: Record<string, unknown>;
    include: typeof PARTIES_INCLUDE;
  }): Promise<PromiseRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    include: typeof PARTIES_INCLUDE;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<PromiseRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
    include: typeof PARTIES_INCLUDE;
  }): Promise<PromiseRecord>;
}

interface PromiseEventClient {
  create(args: {
    data: {
      organizationId: string;
      promiseId: string;
      type: PromiseEventType;
      actorId?: string | null;
      payload: Prisma.InputJsonValue;
    };
  }): Promise<PromiseEventRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<PromiseEventRecord[]>;
}

@Injectable()
export class PromisesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreatePromiseData): Promise<PromiseEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        title: data.title,
        ownerId: data.ownerId,
        dueAt: data.dueAt ?? null,
        parties: {
          create: data.parties.map((party) => ({
            organizationId: tenant.organizationId,
            role: party.role,
            ...(party.contactId ? { contactId: party.contactId } : {}),
            ...(party.userId ? { userId: party.userId } : {}),
          })),
        },
      },
      include: PARTIES_INCLUDE,
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<PromiseEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
      include: PARTIES_INCLUDE,
    });
    return record ? toEntity(record) : null;
  }

  async findAll(params: FindPromisesParams): Promise<PaginatedPromises> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.ownerId ? { ownerId: params.ownerId } : {}),
      ...(params.contactId ? { parties: { some: { contactId: params.contactId } } } : {}),
      ...(params.contactIds?.length
        ? { parties: { some: { contactId: { in: params.contactIds } } } }
        : {}),
      ...(params.search ? { title: { contains: params.search, mode: 'insensitive' } } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        include: PARTIES_INCLUDE,
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

  async update(id: string, data: UpdatePromiseData): Promise<PromiseEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
        ...(data.parties !== undefined
          ? {
              parties: {
                deleteMany: {},
                create: data.parties.map((party) => ({
                  organizationId: this.tenantContextService.getOrThrow().organizationId,
                  role: party.role,
                  ...(party.contactId ? { contactId: party.contactId } : {}),
                  ...(party.userId ? { userId: party.userId } : {}),
                })),
              },
            }
          : {}),
      },
      include: PARTIES_INCLUDE,
    });

    return toEntity(record);
  }

  async updateStatus(id: string, status: PromiseStatus): Promise<PromiseEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: { status },
      include: PARTIES_INCLUDE,
    });

    return toEntity(record);
  }

  async softDelete(id: string): Promise<PromiseEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: { deletedAt: new Date() },
      include: PARTIES_INCLUDE,
    });

    return toEntity(record);
  }

  async addEvent(
    promiseId: string,
    type: PromiseEventType,
    actorId: string | null,
    payload: Record<string, unknown>,
  ): Promise<PromiseEventEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.eventClient().create({
      data: {
        organizationId: tenant.organizationId,
        promiseId,
        type,
        actorId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    return toEventEntity(record);
  }

  async listEvents(promiseId: string, limit = 50): Promise<PromiseEventEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.eventClient().findMany({
      where: { organizationId: tenant.organizationId, promiseId },
      take: limit,
      orderBy: [{ occurredAt: 'desc' }],
    });
    return records.map(toEventEntity);
  }

  private client(): PromiseClient {
    return (this.prisma.system as unknown as { promise: PromiseClient }).promise;
  }

  private eventClient(): PromiseEventClient {
    return (this.prisma.system as unknown as { promiseEvent: PromiseEventClient }).promiseEvent;
  }
}

function toEntity(record: PromiseRecord): PromiseEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    title: record.title,
    status: record.status,
    ownerId: record.ownerId,
    dueAt: record.dueAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    parties: record.parties.map(toPartyEntity),
  };
}

function toPartyEntity(record: PromisePartyRecord): PromisePartyEntity {
  return {
    id: record.id,
    promiseId: record.promiseId,
    role: record.role,
    contactId: record.contactId,
    userId: record.userId,
    createdAt: record.createdAt,
  };
}

function toEventEntity(record: PromiseEventRecord): PromiseEventEntity {
  return {
    id: record.id,
    promiseId: record.promiseId,
    type: record.type,
    actorId: record.actorId,
    payload: toObject(record.payload),
    occurredAt: record.occurredAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
