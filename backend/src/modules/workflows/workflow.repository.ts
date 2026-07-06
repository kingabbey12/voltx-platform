import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowEntity, WorkflowStatus } from './entities/workflow.entity';

export interface CreateWorkflowData {
  name: string;
  description?: string;
  createdBy: string;
}

export interface UpdateWorkflowData {
  name?: string;
  description?: string;
}

export interface FindWorkflowsParams {
  page: number;
  limit: number;
  status?: WorkflowStatus;
  search?: string;
}

export interface PaginatedWorkflows {
  items: WorkflowEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface WorkflowRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  publishedVersion: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface WorkflowClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<WorkflowRecord>;
}

@Injectable()
export class WorkflowRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowData): Promise<WorkflowEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        name: data.name,
        description: data.description ?? null,
        createdBy: data.createdBy,
        status: 'DRAFT',
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<WorkflowEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  /**
   * Used only by WorkflowSchedulerService to bootstrap a tenant context
   * (organizationId + createdBy) for a scheduled trigger firing outside
   * any HTTP request — every other method requires tenant context to
   * already exist, which is exactly what this call has to establish
   * first.
   */
  async findByIdUnscoped(id: string): Promise<WorkflowEntity | null> {
    const record = await this.client().findFirst({ where: { id, deletedAt: null } });
    return record ? toEntity(record) : null;
  }

  async findByName(name: string): Promise<WorkflowEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { name, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async findAll(params: FindWorkflowsParams): Promise<PaginatedWorkflows> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { name: { contains: params.search, mode: 'insensitive' } } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({ where, skip, take: params.limit, orderBy: [{ createdAt: 'desc' }] }),
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

  async update(id: string, data: UpdateWorkflowData): Promise<WorkflowEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
      },
    });
    return toEntity(record);
  }

  async setStatus(
    id: string,
    status: WorkflowStatus,
    publishedVersion?: number,
  ): Promise<WorkflowEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({
      where: { id },
      data: {
        status,
        ...(publishedVersion !== undefined ? { publishedVersion } : {}),
      },
    });
    return toEntity(record);
  }

  async softDelete(id: string): Promise<WorkflowEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.client().update({ where: { id }, data: { deletedAt: new Date() } });
    return toEntity(record);
  }

  private client(): WorkflowClient {
    return (this.prisma.system as unknown as { workflow: WorkflowClient }).workflow;
  }
}

function toEntity(record: WorkflowRecord): WorkflowEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    status: record.status,
    publishedVersion: record.publishedVersion,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
