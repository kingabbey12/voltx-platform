import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import { WorkflowDefinition } from '../../workflows/definition/workflow-definition.types';
import { WorkflowService } from '../../workflows/workflow.service';
import { WorkflowPlanApprovalService, PLAN_RESOURCE_TYPE } from './workflow-engine.approval';
import { AutonomousWorkflowPlanMetrics } from './workflow-engine.metrics';
import { HANDOFF_REQUIRED_STATUS } from './workflow-engine.policy';
import { WorkflowPlanRepository } from './workflow-engine.repository';
import { StoredWorkflowPlan, WorkflowPlanHandoffResult } from './workflow-engine.types';

/**
 * The single, narrow boundary between an approved plan and real execution.
 *
 * It contains no execution logic. It validates that a handoff is allowed,
 * translates the approved steps into a definition the **existing**
 * workflow module understands, and asks that module to create the run.
 * From that point the workflow module owns everything: this service never
 * drives, resumes or completes a run, and the plan's own status can never
 * become "executed".
 */
@Injectable()
export class WorkflowPlanExecutionHandoff {
  constructor(
    private readonly plans: WorkflowPlanRepository,
    private readonly approvalService: WorkflowPlanApprovalService,
    private readonly workflowService: WorkflowService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly metrics: AutonomousWorkflowPlanMetrics,
  ) {}

  async handOff(
    planId: string,
    permissions: string[],
    expectedPlanVersion?: string,
  ): Promise<WorkflowPlanHandoffResult> {
    this.metrics.recordHandoffAttempt();
    try {
      const result = await this.execute(planId, permissions, expectedPlanVersion);
      this.metrics.recordHandoffOutcome('success');
      return result;
    } catch (error) {
      this.metrics.recordHandoffOutcome('failure');
      throw error;
    }
  }

  private async execute(
    planId: string,
    permissions: string[],
    expectedPlanVersion?: string,
  ): Promise<WorkflowPlanHandoffResult> {
    const { organizationId, userId } = this.tenantContext.getOrThrow();

    // Cross-tenant plans are invisible here: findById is tenant-scoped, so
    // another organisation's plan id resolves to null rather than leaking
    // its existence.
    const found = await this.plans.findById(planId);
    if (!found) throw new NotFoundException(`Workflow plan "${planId}" not found`);
    if (found.tenantId !== organizationId) {
      throw new NotFoundException(`Workflow plan "${planId}" not found`);
    }

    // Already handed off — replay the recorded identifiers rather than
    // creating a second run.
    if (found.status === 'handed_off' && found.workflowExecutionId && found.workflowId) {
      return {
        planId: found.id,
        status: found.status,
        workflowId: found.workflowId,
        workflowExecutionId: found.workflowExecutionId,
        handedOffAt: found.handedOffAt ?? found.updatedAt,
        idempotentReplay: true,
      };
    }

    const plan = await this.approvalService.syncStatus(found);

    if (plan.status !== HANDOFF_REQUIRED_STATUS) {
      throw new BadRequestException(
        `Workflow plan "${planId}" is ${plan.status}; only an approved plan can be handed off`,
      );
    }
    if (new Date(plan.expiresAt).getTime() <= Date.now()) {
      await this.plans.setStatus(plan.id, 'expired');
      throw new BadRequestException(`Workflow plan "${planId}" has expired`);
    }
    if (expectedPlanVersion && expectedPlanVersion !== plan.planVersion) {
      throw new BadRequestException(
        `Workflow plan "${planId}" is version ${plan.planVersion}; ${expectedPlanVersion} was approved`,
      );
    }

    // The permissions that justified the plan must still be held at the
    // moment of handoff, not merely when it was approved.
    const held = new Set(permissions);
    const missing = plan.plan.requiredPermissions.filter((permission) => !held.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(
        'The current role no longer holds every permission this plan requires',
      );
    }

    const workflow = await this.workflowService.createWorkflow({
      name: this.workflowNameFor(plan),
      description: `Approved AI workflow plan ${plan.id} (${plan.plan.category}).`,
      definition: this.definitionFor(plan, userId),
    });
    await this.workflowService.publishWorkflow(workflow.id);

    // createRun hands the work to the workflow module without this module
    // driving it: the run is created PENDING and the workflow module's own
    // queue/engine owns execution from here.
    const run = await this.workflowService.createRun(workflow.id, {
      triggerType: 'API',
      input: { planId: plan.id, planVersion: plan.planVersion },
      idempotencyKey: `ai-workflow-plan:${plan.id}`,
    });

    const claimed = await this.plans.claimForHandoff(plan.id, workflow.id, run.id);
    if (!claimed) {
      // Another handoff won the compare-and-swap between our checks and
      // the claim; return its identifiers rather than a second run.
      const current = await this.plans.findById(plan.id);
      if (current?.workflowExecutionId && current.workflowId) {
        return {
          planId: current.id,
          status: current.status,
          workflowId: current.workflowId,
          workflowExecutionId: current.workflowExecutionId,
          handedOffAt: current.handedOffAt ?? current.updatedAt,
          idempotentReplay: true,
        };
      }
      throw new BadRequestException(`Workflow plan "${planId}" could not be handed off`);
    }

    await this.audit.record({
      action: 'ai.workflow_plan.handed_off',
      resource: PLAN_RESOURCE_TYPE,
      resourceId: plan.id,
      metadata: {
        workflowId: workflow.id,
        workflowExecutionId: run.id,
        approvalId: plan.approvalId,
        planVersion: plan.planVersion,
      },
    });

    return {
      planId: claimed.id,
      status: claimed.status,
      workflowId: workflow.id,
      workflowExecutionId: run.id,
      handedOffAt: claimed.handedOffAt ?? claimed.updatedAt,
      idempotentReplay: false,
    };
  }

  /** Unique per plan so a re-handoff can't collide on the name. */
  private workflowNameFor(plan: StoredWorkflowPlan): string {
    return `AI plan ${plan.id.slice(0, 8)} — ${plan.plan.title}`.slice(0, 150);
  }

  /**
   * Every plan step becomes a NOTIFICATION step addressed to the
   * requesting user. That is deliberate: the handoff must not synthesise a
   * business mutation the approver never saw, so the executed workflow
   * tells a human what to do rather than doing it. Richer step types are a
   * future extension that must go back through approval.
   */
  private definitionFor(plan: StoredWorkflowPlan, userId: string): WorkflowDefinition {
    const steps = plan.plan.steps.map((step, index) => ({
      id: `plan-step-${step.order}`,
      name: step.title.slice(0, 150),
      type: 'NOTIFICATION' as const,
      dependsOn: index === 0 ? [] : [`plan-step-${plan.plan.steps[index - 1].order}`],
      config: {
        channel: 'notification' as const,
        userId,
        title: `Plan step ${step.order}: ${plan.plan.title}`.slice(0, 150),
        message: step.title,
        metadata: {
          planId: plan.id,
          planStepKey: step.key,
          decisionId: step.decisionId,
          stepType: step.type,
        },
      },
    }));
    return { steps };
  }
}
