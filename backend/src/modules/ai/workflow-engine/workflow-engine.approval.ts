import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import { AgentApprovalService } from '../approvals/agent-approval.service';
import { AutonomousWorkflowPlanMetrics } from './workflow-engine.metrics';
import { SUBMITTABLE_STATUSES, planStatusForApproval } from './workflow-engine.policy';
import { WorkflowPlanRepository } from './workflow-engine.repository';
import { StoredWorkflowPlan, WorkflowPlanApprovalPayload } from './workflow-engine.types';

export const PLAN_RESOURCE_TYPE = 'ai_workflow_plan';
/** The approval's display name in the existing approver inbox. */
export const PLAN_APPROVAL_TOOL_NAME = 'ai.workflow_plan.execute';

/**
 * Submits plans into the **existing** approval framework
 * (AgentApprovalService / AgentActionApproval) and reads decisions back
 * out of it. It creates no approval state of its own — the plan row only
 * mirrors the approval's status through the documented mapping.
 */
@Injectable()
export class WorkflowPlanApprovalService {
  constructor(
    private readonly plans: WorkflowPlanRepository,
    private readonly approvals: AgentApprovalService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly metrics: AutonomousWorkflowPlanMetrics,
  ) {}

  /**
   * Idempotent: a plan already carrying a pending approval returns that
   * same approval rather than opening a second one.
   */
  async submit(planId: string): Promise<StoredWorkflowPlan> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Workflow plan "${planId}" not found`);

    const synced = await this.syncStatus(plan);
    if (synced.approvalId && synced.status === 'awaiting_approval') {
      this.metrics.recordApprovalSubmission('idempotent');
      return synced;
    }
    if (!SUBMITTABLE_STATUSES.includes(synced.status)) {
      this.metrics.recordApprovalSubmission('failure');
      throw new BadRequestException(
        `Workflow plan "${planId}" is ${synced.status} and can no longer be submitted for approval`,
      );
    }
    if (new Date(synced.expiresAt).getTime() <= Date.now()) {
      this.metrics.recordApprovalSubmission('failure');
      await this.plans.setStatus(synced.id, 'expired');
      this.metrics.recordExpired();
      throw new BadRequestException(`Workflow plan "${planId}" has expired`);
    }

    try {
      const approval = await this.approvals.findOrCreatePendingForResource({
        resourceType: PLAN_RESOURCE_TYPE,
        resourceId: synced.id,
        toolName: PLAN_APPROVAL_TOOL_NAME,
        summary: `Approve the workflow plan "${synced.plan.title}" before any of its steps are carried out.`,
        payload: this.payloadFor(synced) as unknown as Record<string, unknown>,
        expiresAt: new Date(synced.expiresAt),
      });

      const attached = await this.plans.attachApproval(synced.id, approval.id);
      await this.audit.record({
        action: 'ai.workflow_plan.approval_requested',
        resource: PLAN_RESOURCE_TYPE,
        resourceId: synced.id,
        metadata: { approvalId: approval.id, planVersion: synced.planVersion },
      });
      this.metrics.recordApprovalSubmission('success');
      return attached;
    } catch (error) {
      this.metrics.recordApprovalSubmission('failure');
      throw error;
    }
  }

  /**
   * The approval payload. Deliberately carries identifiers, ordered steps
   * and evidence *references* — never a secret, a credential or a full
   * communication body.
   */
  payloadFor(plan: StoredWorkflowPlan): WorkflowPlanApprovalPayload {
    return {
      planId: plan.id,
      planVersion: plan.planVersion,
      title: plan.plan.title,
      objective: plan.plan.objective,
      priority: plan.plan.priority,
      risk: plan.plan.risk,
      requiredPermissions: plan.plan.requiredPermissions,
      requiredRoles: plan.plan.requiredRoles,
      steps: plan.plan.steps.map((step) => ({
        order: step.order,
        title: step.title,
        type: step.type,
      })),
      decisionIds: plan.plan.decisionIds,
      insightIds: plan.plan.insightIds,
      contextSources: plan.plan.contextSources,
      evidenceRefs: plan.plan.evidence.map((item) => ({ id: item.id, label: item.label })),
      requestedByUserId: plan.userId,
      tenantId: plan.tenantId,
      expiresAt: plan.expiresAt,
      approvalReason: plan.plan.explainability.approvalReason,
    };
  }

  /**
   * Reflects the authoritative approval state onto the plan. The approval
   * framework owns the decision; this only mirrors it, and never maps onto
   * an executed state.
   */
  async syncStatus(plan: StoredWorkflowPlan): Promise<StoredWorkflowPlan> {
    if (plan.status === 'handed_off') return plan;

    if (!plan.approvalId) {
      if (this.isExpired(plan) && plan.status === 'awaiting_approval') {
        this.metrics.recordExpired();
        return this.plans.setStatus(plan.id, 'expired');
      }
      return plan;
    }

    const approval = await this.approvals.getByIdOrThrowUnscoped(plan.approvalId);
    // Defence in depth: an approval from another tenant must never drive
    // this plan, even though the repository is already tenant-scoped.
    if (approval.organizationId !== plan.tenantId) return plan;

    const mapped = planStatusForApproval(approval.status);
    // Expiry outranks a still-actionable approval state: an approved plan
    // whose window has closed is expired, not approved, or the listing
    // would keep showing it as ready to hand off after the handoff has
    // already started refusing it.
    const actionable = mapped === 'awaiting_approval' || mapped === 'approved';
    const effective = actionable && this.isExpired(plan) ? 'expired' : mapped;
    if (effective === plan.status) return plan;

    if (effective === 'rejected') this.metrics.recordRejected();
    if (effective === 'expired') this.metrics.recordExpired();
    return this.plans.setStatus(plan.id, effective);
  }

  async syncAll(plans: StoredWorkflowPlan[]): Promise<StoredWorkflowPlan[]> {
    const synced: StoredWorkflowPlan[] = [];
    for (const plan of plans) synced.push(await this.syncStatus(plan));
    return synced;
  }

  /** Cancels a plan the caller owns, through the plan's own lifecycle. */
  async cancel(planId: string): Promise<StoredWorkflowPlan> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Workflow plan "${planId}" not found`);
    if (plan.status === 'handed_off') {
      throw new BadRequestException('A handed-off plan can no longer be cancelled');
    }
    const { userId } = this.tenantContext.getOrThrow();
    await this.audit.record({
      action: 'ai.workflow_plan.cancelled',
      resource: PLAN_RESOURCE_TYPE,
      resourceId: plan.id,
      metadata: { cancelledBy: userId },
    });
    return this.plans.setStatus(plan.id, 'cancelled');
  }

  private isExpired(plan: StoredWorkflowPlan): boolean {
    return new Date(plan.expiresAt).getTime() <= Date.now();
  }
}
