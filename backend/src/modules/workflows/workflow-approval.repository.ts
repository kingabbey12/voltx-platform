import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowApprovalEntity, WorkflowApprovalStatus } from './entities/workflow-support.entity';

export interface CreateWorkflowApprovalData {
  workflowRunId: string;
  stepRunId: string;
  approverRole?: string;
  expiresAt?: Date;
}

interface WorkflowApprovalClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowApprovalEntity>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowApprovalEntity | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowApprovalEntity[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowApprovalEntity>;
}

export interface PaginatedWorkflowApprovals {
  items: WorkflowApprovalEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class WorkflowApprovalRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowApprovalData): Promise<WorkflowApprovalEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowRunId: data.workflowRunId,
        stepRunId: data.stepRunId,
        expiresAt: data.expiresAt ?? null,
        status: 'PENDING',
      },
    });
  }

  async findById(id: string): Promise<WorkflowApprovalEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { id, organizationId: tenant.organizationId } });
  }

  async findByStepRun(stepRunId: string): Promise<WorkflowApprovalEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { stepRunId, organizationId: tenant.organizationId } });
  }

  async listPendingExpired(before: Date): Promise<WorkflowApprovalEntity[]> {
    return this.client().findMany({ where: { status: 'PENDING', expiresAt: { lte: before } } });
  }

  /** Org-scoped, for a human "pending approvals" inbox — distinct from listPendingExpired's sweep, which is unscoped by design. */
  async listPending(page: number, limit: number): Promise<PaginatedWorkflowApprovals> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { organizationId: tenant.organizationId, status: 'PENDING' as const };
    const [items, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.client().count({ where }),
    ]);
    return { items, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
  }

  async decide(
    id: string,
    status: WorkflowApprovalStatus,
    approverUserId?: string,
    comment?: string,
  ): Promise<WorkflowApprovalEntity> {
    return this.client().update({
      where: { id },
      data: {
        status,
        approverUserId: approverUserId ?? null,
        comment: comment ?? null,
        decidedAt: new Date(),
      },
    });
  }

  private client(): WorkflowApprovalClient {
    return (this.prisma.system as unknown as { workflowApproval: WorkflowApprovalClient })
      .workflowApproval;
  }
}
