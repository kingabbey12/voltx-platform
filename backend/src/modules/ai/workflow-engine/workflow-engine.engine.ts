import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ExecutiveDecision, ExecutiveDecisionsResult } from '../decision/decision.types';
import {
  CATEGORY_ROLES,
  MAX_PLANS,
  MAX_PLAN_EVIDENCE,
  MAX_STEPS_PER_PLAN,
  PLANNABLE_CATEGORIES,
  PLAN_RULE_ID,
  PLAN_VERSION,
  STEP_MINUTES,
} from './workflow-engine.policy';
import {
  WorkflowPlan,
  WorkflowPlanEvidenceRef,
  WorkflowPlanStep,
  WorkflowPlanStepType,
} from './workflow-engine.types';

const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 } as const;

/**
 * Pure and deterministic. It reads the Executive Decision set and nothing
 * else — no Prisma client, no domain repository and no AI provider appears
 * anywhere in this file's dependency graph, which is what makes the
 * "planning only, no data access" boundary checkable rather than a
 * convention.
 */
@Injectable()
export class AutonomousWorkflowEngine {
  build(decisions: ExecutiveDecisionsResult): { plans: WorkflowPlan[]; considered: number } {
    const plannable = decisions.decisions.filter(
      (decision) =>
        PLANNABLE_CATEGORIES.includes(decision.category) &&
        // A plan must describe approvable work; a decision that needs no
        // approval is a briefing, not a plan.
        decision.approvalRequired,
    );

    const ranked = [...plannable].sort(
      (left, right) =>
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
        PRIORITY_WEIGHT[right.riskLevel] - PRIORITY_WEIGHT[left.riskLevel] ||
        left.id.localeCompare(right.id),
    );

    return {
      plans: ranked.slice(0, MAX_PLANS).map((decision) => this.planFor(decision, decisions)),
      considered: decisions.decisions.length,
    };
  }

  private planFor(decision: ExecutiveDecision, decisions: ExecutiveDecisionsResult): WorkflowPlan {
    const steps = this.stepsFor(decision);
    const evidence = this.evidenceFor(decision);

    return {
      id: `plan:${decision.id}`,
      planKey: this.planKeyFor(decision),
      version: PLAN_VERSION,
      category: decision.category,
      title: `Plan: ${decision.title}`,
      summary: decision.summary,
      objective: decision.recommendedAction.label,
      priority: decision.priority,
      urgency: decision.urgency,
      businessImpact: decision.businessImpact,
      confidence: decision.confidence,
      risk: decision.riskLevel,
      decisionIds: [decision.id],
      insightIds: [...decision.insightIdsUsed].sort(),
      contextSources: [...decision.contextSourcesUsed].sort(),
      evidence,
      steps,
      estimatedDurationMinutes: steps.reduce((total, step) => total + step.estimatedMinutes, 0),
      requiredRoles: CATEGORY_ROLES[decision.category],
      requiredPermissions: [...decision.requiredPermissions].sort(),
      approvalRequired: true,
      explainability: {
        ruleId: PLAN_RULE_ID,
        ruleVersion: PLAN_VERSION,
        excludedSources: decisions.excludedSources,
        priorityReason: decision.explainability.priorityReason,
        confidenceReason: decision.explainability.confidenceReason,
        riskReason: decision.explainability.riskReason,
        approvalReason:
          'Every step is preparation or a recommendation; nothing runs until a human approves this plan.',
        permissionLimitations: decision.explainability.permissionLimitations,
      },
    };
  }

  /**
   * A fixed four-step shape, bounded by MAX_STEPS_PER_PLAN. Every step is
   * preparation, drafting, notification or a request for approval — none
   * of them names a business mutation.
   */
  private stepsFor(decision: ExecutiveDecision): WorkflowPlanStep[] {
    const shape: Array<{ key: string; title: string; type: WorkflowPlanStepType }> = [
      {
        key: 'review-evidence',
        title: `Review the ${decision.evidence.length} verified record(s) behind this decision`,
        type: 'review',
      },
      { key: 'draft-action', title: `Draft: ${decision.recommendedAction.label}`, type: 'draft' },
      {
        key: 'notify-owners',
        title: `Notify the ${CATEGORY_ROLES[decision.category].join(' or ')} responsible for ${decision.category}`,
        type: 'notify',
      },
      {
        key: 'request-approval',
        title: 'Request approval before anything is carried out',
        type: 'suggest_approval',
      },
    ];

    return shape.slice(0, MAX_STEPS_PER_PLAN).map((step, index) => ({
      order: index + 1,
      key: step.key,
      title: step.title,
      type: step.type,
      decisionId: decision.id,
      requiredPermissions: step.type === 'review' ? [] : [...decision.requiredPermissions].sort(),
      estimatedMinutes: STEP_MINUTES[step.type],
    }));
  }

  private evidenceFor(decision: ExecutiveDecision): WorkflowPlanEvidenceRef[] {
    return [...decision.evidence]
      .sort(
        (left, right) =>
          PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
          left.id.localeCompare(right.id),
      )
      .slice(0, MAX_PLAN_EVIDENCE)
      .map((item) => ({
        id: item.id,
        label: item.label,
        priority: item.priority,
        decisionId: decision.id,
      }));
  }

  /**
   * Stable across regenerations of the same decision, and sensitive to
   * anything that changes what a human would be approving — so a plan
   * whose decision has moved gets a different key, and the version check
   * at handoff catches the mismatch.
   */
  private planKeyFor(decision: ExecutiveDecision): string {
    const material = [
      PLAN_VERSION,
      decision.id,
      decision.category,
      decision.priority,
      decision.riskLevel,
      decision.recommendedAction.code,
      [...decision.requiredPermissions].sort().join(','),
    ].join('|');
    return createHash('sha256').update(material).digest('hex').slice(0, 32);
  }
}
