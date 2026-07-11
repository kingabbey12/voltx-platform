import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowDefinition } from './definition/workflow-definition.types';
import { WorkflowTemplateEntity } from './entities/workflow-template.entity';

export interface CreateWorkflowTemplateData {
  key: string;
  name: string;
  description?: string;
  category: string;
  definition: WorkflowDefinition;
  isSystem?: boolean;
  createdBy?: string;
}

export interface FindWorkflowTemplatesParams {
  page: number;
  limit: number;
  category?: string;
}

export interface PaginatedWorkflowTemplates {
  items: WorkflowTemplateEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface WorkflowTemplateClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowTemplateEntity>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowTemplateEntity | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowTemplateEntity[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowTemplateEntity>;
}

/**
 * System templates (isSystem: true) are org-less (organizationId: null)
 * and visible to every org; a custom template additionally carries the
 * creating org's id. Reads always include both — org-scoped rows plus
 * every system row — so the catalog and an org's own saved templates
 * appear in one list.
 */
@Injectable()
export class WorkflowTemplateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowTemplateData): Promise<WorkflowTemplateEntity> {
    const organizationId = data.isSystem
      ? null
      : this.tenantContextService.getOrThrow().organizationId;
    return this.client().create({
      data: {
        organizationId,
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        definition: data.definition,
        isSystem: data.isSystem ?? false,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async findByKey(key: string): Promise<WorkflowTemplateEntity | null> {
    const tenant = this.tenantContextService.get();
    return this.client().findFirst({
      where: {
        key,
        deletedAt: null,
        OR: [{ isSystem: true }, { organizationId: tenant?.organizationId ?? '__none__' }],
      },
    });
  }

  async findAll(params: FindWorkflowTemplatesParams): Promise<PaginatedWorkflowTemplates> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      deletedAt: null,
      OR: [{ isSystem: true }, { organizationId: tenant.organizationId }],
      ...(params.category ? { category: params.category } : {}),
    };

    const [items, total] = await Promise.all([
      this.client().findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'desc' }],
      }),
      this.client().count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async softDelete(id: string): Promise<WorkflowTemplateEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, isSystem: false, deletedAt: null },
    });
    if (!existing) {
      return null;
    }
    return this.client().update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private client(): WorkflowTemplateClient {
    return (this.prisma.system as unknown as { workflowTemplate: WorkflowTemplateClient })
      .workflowTemplate;
  }
}
