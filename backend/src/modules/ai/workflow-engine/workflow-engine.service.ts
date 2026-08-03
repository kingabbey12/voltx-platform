import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ExecutiveContextService } from '../context/context.service';
import { ExecutiveContext } from '../context/context.types';
import { ExecutiveDecisionsService } from '../decision/decision.service';
import { ExecutiveDecisionsResult } from '../decision/decision.types';
import { ExecutiveInsightsService } from '../insights/insights.service';
import { ExecutiveInsightsResult } from '../insights/insights.types';
import { WorkflowPlanApprovalService } from './workflow-engine.approval';
import { AutonomousWorkflowEngine } from './workflow-engine.engine';
import { AutonomousWorkflowPlanMetrics } from './workflow-engine.metrics';
import { WorkflowPlanRepository } from './workflow-engine.repository';
import {
  StoredWorkflowPlan,
  WorkflowPlanStreamEvent,
  WorkflowPlansResult,
} from './workflow-engine.types';

@Injectable()
export class AutonomousWorkflowPlansService {
  constructor(
    private readonly context: ExecutiveContextService,
    private readonly insights: ExecutiveInsightsService,
    private readonly decisions: ExecutiveDecisionsService,
    private readonly engine: AutonomousWorkflowEngine,
    private readonly repository: WorkflowPlanRepository,
    private readonly approvals: WorkflowPlanApprovalService,
    private readonly audit: AuditService,
    private readonly metrics: AutonomousWorkflowPlanMetrics,
  ) {}

  /** Full path for the HTTP controller. */
  async generate(permissions: string[], submitForApproval = true): Promise<WorkflowPlansResult> {
    const [context, insights] = await Promise.all([
      this.context.getExecutiveContext({ permissions }),
      this.insights.generate(permissions),
    ]);
    const decisions = await this.decisions.generateFrom(context, insights);
    return this.generateFrom(decisions, submitForApproval);
  }

  /**
   * Used by the Executive Assistant, which already holds a verified
   * decision set for the turn — nothing is recomputed.
   */
  async generateFrom(
    decisions: ExecutiveDecisionsResult,
    submitForApproval = true,
  ): Promise<WorkflowPlansResult> {
    const startedAt = performance.now();
    const { plans, considered } = this.engine.build(decisions);

    const stored: StoredWorkflowPlan[] = [];
    for (const plan of plans) {
      const persisted = await this.repository.upsertGenerated(plan);
      // Submission is part of generation: a plan exists to be approved, so
      // it enters the existing approval queue immediately and stays
      // awaiting_approval until a human decides.
      stored.push(submitForApproval ? await this.approvals.submit(persisted.id) : persisted);
      this.metrics.recordCategory(plan.category);
      this.metrics.recordPriority(plan.priority);
      this.metrics.recordStepCount(plan.steps.length);
    }

    this.metrics.recordGenerated(stored.length);
    this.metrics.recordGenerationDuration(performance.now() - startedAt);
    for (const plan of stored) this.metrics.recordStatus(plan.status);

    await this.audit.record({
      action: 'generate',
      resource: 'ai_workflow_plan',
      resourceId: decisions.tenantId,
      metadata: {
        planCount: stored.length,
        decisionsConsidered: considered,
        approvalRequired: true,
      },
    });

    return {
      planSetVersion: '1.0',
      generatedAt: decisions.generatedAt,
      tenantId: decisions.tenantId,
      userId: decisions.userId,
      plans: stored,
      excludedSources: decisions.excludedSources,
      decisionsConsidered: considered,
      plansGenerated: stored.length,
    };
  }

  /** Listing reads the store and reconciles each plan's approval state. */
  async list(): Promise<StoredWorkflowPlan[]> {
    await this.repository.expireOverdue();
    return this.approvals.syncAll(await this.repository.list());
  }

  async getOne(planId: string): Promise<StoredWorkflowPlan | null> {
    const plan = await this.repository.findById(planId);
    return plan ? this.approvals.syncStatus(plan) : null;
  }

  /**
   * Streaming generation. Emits user-safe structured progress only — step
   * titles, counts and identifiers. No model reasoning passes through
   * here, because the planner is deterministic and has none.
   */
  async *stream(
    permissions: string[],
    objective: string,
    signal?: AbortSignal,
  ): AsyncGenerator<WorkflowPlanStreamEvent, void> {
    try {
      yield { type: 'plan_started', objective };
      if (signal?.aborted) return;

      const [context, insights] = await Promise.all([
        this.context.getExecutiveContext({ permissions }),
        this.insights.generate(permissions),
      ]);
      const decisions = await this.decisions.generateFrom(context, insights);
      if (signal?.aborted) return;
      yield {
        type: 'source_loaded',
        source: 'decisions',
        decisionsConsidered: decisions.decisions.length,
      };

      const { plans } = this.engine.build(decisions);
      for (const plan of plans) {
        for (const step of plan.steps) {
          if (signal?.aborted) return;
          yield {
            type: 'step_generated',
            planKey: plan.planKey,
            order: step.order,
            title: step.title,
          };
        }
      }

      const result = await this.generateFrom(decisions);
      if (signal?.aborted) return;
      for (const plan of result.plans) {
        if (plan.approvalId) {
          yield {
            type: 'approval_submitted',
            planId: plan.id,
            approvalId: plan.approvalId,
            status: plan.status,
          };
        }
      }

      yield { type: 'plan_completed', result };
    } catch (error) {
      // Safe error payload: a stable code plus the exception's own message,
      // never a stack trace or internal state.
      yield {
        type: 'plan_failed',
        code: error instanceof Error ? error.name : 'WorkflowPlanError',
        message: error instanceof Error ? error.message : 'Workflow plan generation failed.',
      };
    }
  }

  /** Exposed for the Assistant, which already holds these objects. */
  async generateForAssistant(
    _context: ExecutiveContext,
    _insights: ExecutiveInsightsResult,
    decisions: ExecutiveDecisionsResult,
  ): Promise<WorkflowPlansResult> {
    return this.generateFrom(decisions);
  }
}
