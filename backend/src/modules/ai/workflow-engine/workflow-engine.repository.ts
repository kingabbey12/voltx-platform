import { Injectable } from '@nestjs/common';
import { AiWorkflowPlanStatus, Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { PLAN_TTL_MS } from './workflow-engine.policy';
import { StoredWorkflowPlan, WorkflowPlan, WorkflowPlanStatus } from './workflow-engine.types';

const STATUS_TO_API: Record<AiWorkflowPlanStatus, WorkflowPlanStatus> = {
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  HANDED_OFF: 'handed_off',
};

const STATUS_TO_DB: Record<WorkflowPlanStatus, AiWorkflowPlanStatus> = {
  awaiting_approval: 'AWAITING_APPROVAL',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
  expired: 'EXPIRED',
  handed_off: 'HANDED_OFF',
};

type PlanRecord = Prisma.AiWorkflowPlanGetPayload<Record<string, never>>;

/**
 * The only file in the workflow engine that touches Prisma, and it touches
 * exactly one table — the engine's own plan store. It never reads a
 * domain table; business data reaches the planner solely through the
 * Executive Decision set.
 */
@Injectable()
export class WorkflowPlanRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Idempotent by (tenant, user, planKey): regenerating the same plan
   * refreshes its body and expiry but never resets an approval already in
   * flight, and never rewinds a terminal state.
   */
  async upsertGenerated(plan: WorkflowPlan): Promise<StoredWorkflowPlan> {
    const { organizationId, userId } = this.tenantContext.getOrThrow();
    const expiresAt = new Date(Date.now() + PLAN_TTL_MS);
    const body = plan as unknown as Prisma.InputJsonValue;

    const existing = await this.prisma.system.aiWorkflowPlan.findUnique({
      where: {
        organizationId_userId_planKey: { organizationId, userId, planKey: plan.planKey },
      },
    });

    if (!existing || existing.deletedAt) {
      if (existing) {
        return this.toEntity(
          await this.prisma.system.aiWorkflowPlan.update({
            where: { id: existing.id },
            data: {
              plan: body,
              planVersion: plan.version,
              status: 'AWAITING_APPROVAL',
              approvalId: null,
              workflowId: null,
              workflowExecutionId: null,
              approvedAt: null,
              rejectedAt: null,
              handedOffAt: null,
              deletedAt: null,
              expiresAt,
            },
          }),
        );
      }
      return this.toEntity(
        await this.prisma.system.aiWorkflowPlan.create({
          data: {
            organizationId,
            userId,
            planKey: plan.planKey,
            planVersion: plan.version,
            plan: body,
            status: 'AWAITING_APPROVAL',
            expiresAt,
          },
        }),
      );
    }

    // A plan that has already left AWAITING_APPROVAL is a record of what a
    // human decided on; regeneration must not quietly rewrite it.
    if (existing.status !== 'AWAITING_APPROVAL') return this.toEntity(existing);

    return this.toEntity(
      await this.prisma.system.aiWorkflowPlan.update({
        where: { id: existing.id },
        data: { plan: body, planVersion: plan.version, expiresAt },
      }),
    );
  }

  async list(): Promise<StoredWorkflowPlan[]> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const records = await this.prisma.system.aiWorkflowPlan.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toEntity(record));
  }

  /** Tenant-scoped by construction — a cross-tenant id resolves to null. */
  async findById(id: string): Promise<StoredWorkflowPlan | null> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const record = await this.prisma.system.aiWorkflowPlan.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByApprovalIdUnscoped(approvalId: string): Promise<StoredWorkflowPlan | null> {
    const record = await this.prisma.system.aiWorkflowPlan.findFirst({
      where: { approvalId, deletedAt: null },
    });
    return record ? this.toEntity(record) : null;
  }

  async attachApproval(id: string, approvalId: string): Promise<StoredWorkflowPlan> {
    const { organizationId } = this.tenantContext.getOrThrow();
    await this.prisma.system.aiWorkflowPlan.updateMany({
      where: { id, organizationId },
      data: { approvalId, status: 'AWAITING_APPROVAL' },
    });
    return this.toEntity(
      await this.prisma.system.aiWorkflowPlan.findUniqueOrThrow({ where: { id } }),
    );
  }

  async setStatus(id: string, status: WorkflowPlanStatus): Promise<StoredWorkflowPlan> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const now = new Date();
    await this.prisma.system.aiWorkflowPlan.updateMany({
      where: { id, organizationId },
      data: {
        status: STATUS_TO_DB[status],
        ...(status === 'approved' ? { approvedAt: now } : {}),
        ...(status === 'rejected' ? { rejectedAt: now } : {}),
      },
    });
    return this.toEntity(
      await this.prisma.system.aiWorkflowPlan.findUniqueOrThrow({ where: { id } }),
    );
  }

  /**
   * Compare-and-swap on the approved state: of two concurrent handoffs for
   * the same plan only one can match, so a plan can never be handed to the
   * workflow module twice.
   */
  async claimForHandoff(
    id: string,
    workflowId: string,
    workflowExecutionId: string,
  ): Promise<StoredWorkflowPlan | null> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const result = await this.prisma.system.aiWorkflowPlan.updateMany({
      where: { id, organizationId, status: 'APPROVED', workflowExecutionId: null },
      data: {
        status: 'HANDED_OFF',
        workflowId,
        workflowExecutionId,
        handedOffAt: new Date(),
      },
    });
    if (result.count === 0) return null;
    return this.toEntity(
      await this.prisma.system.aiWorkflowPlan.findUniqueOrThrow({ where: { id } }),
    );
  }

  /** Marks every past-due plan expired. Returns how many changed. */
  async expireOverdue(): Promise<number> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const result = await this.prisma.system.aiWorkflowPlan.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        expiresAt: { lt: new Date() },
        status: { in: ['AWAITING_APPROVAL', 'APPROVED'] },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  private toEntity(record: PlanRecord): StoredWorkflowPlan {
    return {
      id: record.id,
      tenantId: record.organizationId,
      userId: record.userId,
      planKey: record.planKey,
      planVersion: record.planVersion,
      plan: record.plan as unknown as WorkflowPlan,
      status: STATUS_TO_API[record.status],
      approvalId: record.approvalId,
      workflowId: record.workflowId,
      workflowExecutionId: record.workflowExecutionId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      handedOffAt: record.handedOffAt?.toISOString() ?? null,
    };
  }
}
