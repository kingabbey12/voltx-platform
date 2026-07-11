import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowVariableEntity, WorkflowVariableType } from './entities/workflow-variable.entity';

export interface CreateWorkflowVariableData {
  workflowId?: string | null;
  key: string;
  type?: WorkflowVariableType;
  defaultValue?: unknown;
  description?: string;
}

export interface UpdateWorkflowVariableData {
  type?: WorkflowVariableType;
  defaultValue?: unknown;
  description?: string;
}

interface WorkflowVariableClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowVariableEntity>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowVariableEntity | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowVariableEntity[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowVariableEntity>;
  delete(args: { where: { id: string } }): Promise<WorkflowVariableEntity>;
}

/** workflowId: null/undefined = an org-level shared variable, visible to every workflow. */
@Injectable()
export class WorkflowVariableRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowVariableData): Promise<WorkflowVariableEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowId: data.workflowId ?? null,
        key: data.key,
        type: data.type ?? 'STRING',
        defaultValue: data.defaultValue ?? null,
        description: data.description ?? null,
      },
    });
  }

  async findById(id: string): Promise<WorkflowVariableEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { id, organizationId: tenant.organizationId } });
  }

  /** workflowId: null lists only org-level variables; omit to list both org-level and this-workflow-scoped. */
  async listForWorkflow(workflowId: string | null): Promise<WorkflowVariableEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(workflowId === null
          ? { workflowId: null }
          : { OR: [{ workflowId }, { workflowId: null }] }),
      },
      orderBy: [{ key: 'asc' }],
    });
  }

  async update(
    id: string,
    data: UpdateWorkflowVariableData,
  ): Promise<WorkflowVariableEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.defaultValue !== undefined ? { defaultValue: data.defaultValue } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
      },
    });
  }

  async remove(id: string): Promise<WorkflowVariableEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().delete({ where: { id } });
  }

  private client(): WorkflowVariableClient {
    return (this.prisma.system as unknown as { workflowVariable: WorkflowVariableClient })
      .workflowVariable;
  }
}
