import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AgentApprovalService } from '../src/modules/ai/approvals/agent-approval.service';
import { AgentActionApprovalEntity } from '../src/modules/ai/approvals/entities/agent-action-approval.entity';
import {
  PLAN_APPROVAL_TOOL_NAME,
  PLAN_RESOURCE_TYPE,
  WorkflowPlanApprovalService,
} from '../src/modules/ai/workflow-engine/workflow-engine.approval';
import { WorkflowPlanExecutionHandoff } from '../src/modules/ai/workflow-engine/workflow-engine.handoff';
import { AutonomousWorkflowPlanMetrics } from '../src/modules/ai/workflow-engine/workflow-engine.metrics';
import { WorkflowPlanRepository } from '../src/modules/ai/workflow-engine/workflow-engine.repository';
import {
  StoredWorkflowPlan,
  WorkflowPlan,
} from '../src/modules/ai/workflow-engine/workflow-engine.types';
import { WorkflowService } from '../src/modules/workflows/workflow.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

const TENANT = 'tenant-1';
const USER = 'user-1';
const PERMISSIONS = ['sales.opportunity.read', 'sales.opportunity.update'];

function planBody(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    id: 'plan:decision:sales',
    planKey: 'key-1',
    version: '1.0',
    category: 'sales',
    title: 'Plan: review deals',
    summary: 'summary',
    objective: 'Review and follow up on the flagged deals',
    priority: 'high',
    urgency: 'this_week',
    businessImpact: 'high',
    confidence: 'high',
    risk: 'high',
    decisionIds: ['decision:sales'],
    insightIds: ['sales:crm'],
    contextSources: ['crm'],
    evidence: [
      { id: 'opportunity:a', label: 'Renewal A', priority: 'high', decisionId: 'decision:sales' },
    ],
    steps: [
      {
        order: 1,
        key: 'review-evidence',
        title: 'Review evidence',
        type: 'review',
        decisionId: 'decision:sales',
        requiredPermissions: [],
        estimatedMinutes: 10,
      },
      {
        order: 2,
        key: 'draft-action',
        title: 'Draft the follow-up',
        type: 'draft',
        decisionId: 'decision:sales',
        requiredPermissions: PERMISSIONS,
        estimatedMinutes: 15,
      },
    ],
    estimatedDurationMinutes: 25,
    requiredRoles: ['manager'],
    requiredPermissions: PERMISSIONS,
    approvalRequired: true,
    explainability: {
      ruleId: 'workflow-plan-from-decision',
      ruleVersion: '1.0',
      excludedSources: [],
      priorityReason: 'priority high',
      confidenceReason: 'confidence high',
      riskReason: 'risk high',
      approvalReason: 'nothing runs until a human approves this plan',
      permissionLimitations: [],
    },
    ...overrides,
  };
}

function stored(overrides: Partial<StoredWorkflowPlan> = {}): StoredWorkflowPlan {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT,
    userId: USER,
    planKey: 'key-1',
    planVersion: '1.0',
    plan: planBody(),
    status: 'awaiting_approval',
    approvalId: null,
    workflowId: null,
    workflowExecutionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: future,
    approvedAt: null,
    rejectedAt: null,
    handedOffAt: null,
    ...overrides,
  };
}

function approval(overrides: Partial<AgentActionApprovalEntity> = {}): AgentActionApprovalEntity {
  return {
    id: 'approval-1',
    organizationId: TENANT,
    agentRunId: null,
    resourceType: PLAN_RESOURCE_TYPE,
    resourceId: stored().id,
    toolName: PLAN_APPROVAL_TOOL_NAME,
    input: {},
    summary: 'Approve the plan',
    status: 'PENDING',
    approverUserId: null,
    comment: null,
    expiresAt: null,
    decidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildHarness() {
  const metrics = new AutonomousWorkflowPlanMetrics(
    new MetricsService({ get: jest.fn().mockReturnValue(false) } as never),
  );
  const repository = {
    findById: jest.fn(),
    setStatus: jest.fn(),
    attachApproval: jest.fn(),
    claimForHandoff: jest.fn(),
  };
  const approvals = {
    findOrCreatePendingForResource: jest.fn(),
    getByIdOrThrowUnscoped: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const tenantContext = {
    getOrThrow: jest.fn().mockReturnValue({ organizationId: TENANT, userId: USER }),
  };
  const approvalService = new WorkflowPlanApprovalService(
    repository as unknown as WorkflowPlanRepository,
    approvals as unknown as AgentApprovalService,
    audit as unknown as AuditService,
    tenantContext as unknown as TenantContextService,
    metrics,
  );
  const workflowService = {
    createWorkflow: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
    publishWorkflow: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
    createRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
    runWorkflow: jest.fn(),
    runWorkflowStream: jest.fn(),
  };
  const handoff = new WorkflowPlanExecutionHandoff(
    repository as unknown as WorkflowPlanRepository,
    approvalService,
    workflowService as unknown as WorkflowService,
    audit as unknown as AuditService,
    tenantContext as unknown as TenantContextService,
    metrics,
  );
  return { metrics, repository, approvals, audit, approvalService, workflowService, handoff };
}

type Harness = ReturnType<typeof buildHarness>;

describe('WorkflowPlanApprovalService', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildHarness();
  });

  it('submits through the existing approval service and stores the approval id', async () => {
    const plan = stored();
    harness.repository.findById.mockResolvedValue(plan);
    harness.approvals.findOrCreatePendingForResource.mockResolvedValue(approval());
    harness.repository.attachApproval.mockResolvedValue(stored({ approvalId: 'approval-1' }));

    const result = await harness.approvalService.submit(plan.id);

    expect(harness.approvals.findOrCreatePendingForResource).toHaveBeenCalledTimes(1);
    expect(result.approvalId).toBe('approval-1');
    expect(result.status).toBe('awaiting_approval');
    expect(harness.repository.attachApproval).toHaveBeenCalledWith(plan.id, 'approval-1');
  });

  it('builds an approval payload with identifiers, steps and evidence references only', async () => {
    const plan = stored();
    harness.repository.findById.mockResolvedValue(plan);
    harness.approvals.findOrCreatePendingForResource.mockResolvedValue(approval());
    harness.repository.attachApproval.mockResolvedValue(stored({ approvalId: 'approval-1' }));

    await harness.approvalService.submit(plan.id);
    const submitCalls = harness.approvals.findOrCreatePendingForResource.mock.calls as Array<
      [{ resourceType: string; resourceId: string; payload: Record<string, unknown> }]
    >;
    const call = submitCalls[0][0];

    expect(call.resourceType).toBe(PLAN_RESOURCE_TYPE);
    expect(call.resourceId).toBe(plan.id);
    expect(Object.keys(call.payload).sort()).toEqual(
      [
        'approvalReason',
        'contextSources',
        'decisionIds',
        'evidenceRefs',
        'expiresAt',
        'insightIds',
        'objective',
        'planId',
        'planVersion',
        'priority',
        'requestedByUserId',
        'requiredPermissions',
        'requiredRoles',
        'risk',
        'steps',
        'tenantId',
        'title',
      ].sort(),
    );
    // Evidence travels as a reference, never as a full record body.
    const refs = call.payload.evidenceRefs as Array<Record<string, unknown>>;
    expect(Object.keys(refs[0]).sort()).toEqual(['id', 'label']);
    const serialized = JSON.stringify(call.payload);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('password');
  });

  it('is idempotent — a second submission returns the approval already in flight', async () => {
    harness.repository.findById.mockResolvedValue(stored({ approvalId: 'approval-1' }));
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval());

    const result = await harness.approvalService.submit(stored().id);

    expect(result.approvalId).toBe('approval-1');
    expect(harness.approvals.findOrCreatePendingForResource).not.toHaveBeenCalled();
  });

  it('surfaces a submission failure instead of silently continuing', async () => {
    harness.repository.findById.mockResolvedValue(stored());
    harness.approvals.findOrCreatePendingForResource.mockRejectedValue(
      new Error('approval service unavailable'),
    );

    await expect(harness.approvalService.submit(stored().id)).rejects.toThrow(
      'approval service unavailable',
    );
    const output = await harness.metrics['approvalSubmissions'].get();
    expect(output.values.find((value) => value.labels.result === 'failure')?.value).toBe(1);
  });

  it('rejects a plan id from another tenant as not found', async () => {
    harness.repository.findById.mockResolvedValue(null);
    await expect(
      harness.approvalService.submit('22222222-2222-4222-8222-222222222222'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to submit an expired plan and records the expiry', async () => {
    const expired = stored({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    harness.repository.findById.mockResolvedValue(expired);
    harness.repository.setStatus.mockResolvedValue(stored({ status: 'expired' }));

    await expect(harness.approvalService.submit(expired.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.repository.setStatus).toHaveBeenCalledWith(expired.id, 'expired');
  });

  it.each([
    ['APPROVED', 'approved'],
    ['REJECTED', 'rejected'],
    ['CANCELLED', 'cancelled'],
    ['EXPIRED', 'expired'],
  ] as const)('mirrors an approval decided %s onto the plan as %s', async (decided, expected) => {
    const plan = stored({ approvalId: 'approval-1' });
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: decided }));
    harness.repository.setStatus.mockResolvedValue(stored({ status: expected }));

    const synced = await harness.approvalService.syncStatus(plan);

    expect(harness.repository.setStatus).toHaveBeenCalledWith(plan.id, expected);
    expect(synced.status).toBe(expected);
  });

  it('never lets an approval from another tenant drive a plan', async () => {
    const plan = stored({ approvalId: 'approval-1' });
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(
      approval({ status: 'APPROVED', organizationId: 'tenant-2' }),
    );

    const synced = await harness.approvalService.syncStatus(plan);

    expect(synced.status).toBe('awaiting_approval');
    expect(harness.repository.setStatus).not.toHaveBeenCalled();
  });

  it('treats a still-pending approval on a past-due plan as expired', async () => {
    const plan = stored({
      approvalId: 'approval-1',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'PENDING' }));
    harness.repository.setStatus.mockResolvedValue(stored({ status: 'expired' }));

    await harness.approvalService.syncStatus(plan);
    expect(harness.repository.setStatus).toHaveBeenCalledWith(plan.id, 'expired');
  });
});

describe('WorkflowPlanExecutionHandoff', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildHarness();
  });

  function approvedPlan(overrides: Partial<StoredWorkflowPlan> = {}) {
    return stored({ status: 'approved', approvalId: 'approval-1', ...overrides });
  }

  it('hands an approved plan to the existing workflow service exactly once', async () => {
    const plan = approvedPlan();
    harness.repository.findById.mockResolvedValue(plan);
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));
    harness.repository.claimForHandoff.mockResolvedValue(
      stored({ status: 'handed_off', workflowId: 'workflow-1', workflowExecutionId: 'run-1' }),
    );

    const result = await harness.handoff.handOff(plan.id, PERMISSIONS);

    expect(harness.workflowService.createWorkflow).toHaveBeenCalledTimes(1);
    expect(harness.workflowService.publishWorkflow).toHaveBeenCalledTimes(1);
    expect(harness.workflowService.createRun).toHaveBeenCalledTimes(1);
    expect(result.workflowExecutionId).toBe('run-1');
    expect(result.status).toBe('handed_off');
    expect(result.idempotentReplay).toBe(false);
  });

  it('performs no business action itself — only the workflow service is invoked', async () => {
    const plan = approvedPlan();
    harness.repository.findById.mockResolvedValue(plan);
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));
    harness.repository.claimForHandoff.mockResolvedValue(
      stored({ status: 'handed_off', workflowId: 'workflow-1', workflowExecutionId: 'run-1' }),
    );

    await harness.handoff.handOff(plan.id, PERMISSIONS);

    // The AI module never drives the run: it creates it and stops.
    expect(harness.workflowService.runWorkflow).not.toHaveBeenCalled();
    expect(harness.workflowService.runWorkflowStream).not.toHaveBeenCalled();

    const createCalls = harness.workflowService.createWorkflow.mock.calls as Array<
      [{ definition: { steps: Array<{ type: string }> } }]
    >;
    const definition = createCalls[0][0];
    // Every translated step is a notification to a human, never a mutation.
    expect(definition.definition.steps.every((step) => step.type === 'NOTIFICATION')).toBe(true);
    expect(definition.definition.steps).toHaveLength(plan.plan.steps.length);
  });

  it.each([
    ['awaiting_approval', 'PENDING'],
    ['rejected', 'REJECTED'],
    ['cancelled', 'CANCELLED'],
  ] as const)('refuses to hand off a %s plan', async (status, approvalStatus) => {
    harness.repository.findById.mockResolvedValue(stored({ status, approvalId: 'approval-1' }));
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(
      approval({ status: approvalStatus }),
    );
    harness.repository.setStatus.mockResolvedValue(stored({ status }));

    await expect(harness.handoff.handOff(stored().id, PERMISSIONS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('refuses to hand off an expired plan', async () => {
    harness.repository.findById.mockResolvedValue(
      approvedPlan({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));
    harness.repository.setStatus.mockResolvedValue(stored({ status: 'expired' }));

    await expect(harness.handoff.handOff(stored().id, PERMISSIONS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('refuses a plan whose version no longer matches what was approved', async () => {
    harness.repository.findById.mockResolvedValue(approvedPlan());
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));

    await expect(harness.handoff.handOff(stored().id, PERMISSIONS, '0.9')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('refuses when the caller no longer holds every required permission', async () => {
    harness.repository.findById.mockResolvedValue(approvedPlan());
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));

    await expect(
      harness.handoff.handOff(stored().id, ['sales.opportunity.read']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('refuses a plan belonging to another tenant', async () => {
    harness.repository.findById.mockResolvedValue(null);
    await expect(harness.handoff.handOff(stored().id, PERMISSIONS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('replays a completed handoff instead of creating a second run', async () => {
    harness.repository.findById.mockResolvedValue(
      stored({
        status: 'handed_off',
        workflowId: 'workflow-1',
        workflowExecutionId: 'run-1',
        handedOffAt: new Date().toISOString(),
      }),
    );

    const result = await harness.handoff.handOff(stored().id, PERMISSIONS);

    expect(result.idempotentReplay).toBe(true);
    expect(result.workflowExecutionId).toBe('run-1');
    expect(harness.workflowService.createWorkflow).not.toHaveBeenCalled();
  });

  it('loses the claim race gracefully rather than double-running a plan', async () => {
    harness.repository.findById
      .mockResolvedValueOnce(approvedPlan())
      .mockResolvedValueOnce(
        stored({ status: 'handed_off', workflowId: 'workflow-9', workflowExecutionId: 'run-9' }),
      );
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));
    harness.repository.claimForHandoff.mockResolvedValue(null);

    const result = await harness.handoff.handOff(stored().id, PERMISSIONS);

    expect(result.idempotentReplay).toBe(true);
    expect(result.workflowExecutionId).toBe('run-9');
  });

  it('records an audit event naming the workflow it handed to', async () => {
    harness.repository.findById.mockResolvedValue(approvedPlan());
    harness.approvals.getByIdOrThrowUnscoped.mockResolvedValue(approval({ status: 'APPROVED' }));
    harness.repository.claimForHandoff.mockResolvedValue(
      stored({ status: 'handed_off', workflowId: 'workflow-1', workflowExecutionId: 'run-1' }),
    );

    await harness.handoff.handOff(stored().id, PERMISSIONS);

    const calls = harness.audit.record.mock.calls as Array<[{ action: string; metadata: object }]>;
    const handoffAudit = calls.find(([entry]) => entry.action === 'ai.workflow_plan.handed_off');
    expect(handoffAudit).toBeDefined();
    expect(handoffAudit![0].metadata).toEqual(
      expect.objectContaining({ workflowId: 'workflow-1', workflowExecutionId: 'run-1' }),
    );
  });
});

describe('AutonomousWorkflowPlanMetrics', () => {
  let metrics: AutonomousWorkflowPlanMetrics;
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
    metrics = new AutonomousWorkflowPlanMetrics(service);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('registers every collector exactly once', async () => {
    metrics.recordGenerated(2);
    metrics.recordGenerationDuration(25);
    const output = await service.getMetrics();

    for (const name of [
      'voltx_workflow_plans_generated_total',
      'voltx_workflow_plan_generation_duration_seconds',
      'voltx_workflow_plan_approval_submissions_total',
      'voltx_workflow_plans_by_category_total',
      'voltx_workflow_plans_by_priority_total',
      'voltx_workflow_plans_by_status_total',
      'voltx_workflow_plan_step_count',
      'voltx_workflow_plan_handoff_attempts_total',
      'voltx_workflow_plan_handoff_results_total',
      'voltx_workflow_plans_rejected_total',
      'voltx_workflow_plans_expired_total',
    ]) {
      expect(output.match(new RegExp(`^# HELP ${name} `, 'gm')) ?? []).toHaveLength(1);
    }
  });

  it('records each metric with its documented value', async () => {
    metrics.recordGenerated(3);
    metrics.recordCategory('sales');
    metrics.recordPriority('high');
    metrics.recordStatus('awaiting_approval');
    metrics.recordStepCount(4);
    metrics.recordApprovalSubmission('success');
    metrics.recordApprovalSubmission('failure');
    metrics.recordHandoffAttempt();
    metrics.recordHandoffOutcome('success');
    metrics.recordRejected();
    metrics.recordExpired();

    const output = await service.getMetrics();
    expect(output).toContain('voltx_workflow_plans_generated_total 3');
    expect(output).toContain('voltx_workflow_plans_by_category_total{category="sales"} 1');
    expect(output).toContain('voltx_workflow_plans_by_priority_total{priority="high"} 1');
    expect(output).toContain('voltx_workflow_plans_by_status_total{status="awaiting_approval"} 1');
    expect(output).toContain('voltx_workflow_plan_step_count_count 1');
    expect(output).toContain('voltx_workflow_plan_approval_submissions_total{result="success"} 1');
    expect(output).toContain('voltx_workflow_plan_approval_submissions_total{result="failure"} 1');
    expect(output).toContain('voltx_workflow_plan_handoff_attempts_total 1');
    expect(output).toContain('voltx_workflow_plan_handoff_results_total{result="success"} 1');
    expect(output).toContain('voltx_workflow_plans_rejected_total 1');
    expect(output).toContain('voltx_workflow_plans_expired_total 1');
  });

  it('never labels a metric with tenant, user, plan, approval or workflow identifiers', async () => {
    metrics.recordCategory('sales');
    metrics.recordPriority('critical');
    metrics.recordStatus('handed_off');
    metrics.recordApprovalSubmission('success');
    metrics.recordHandoffOutcome('failure');

    const output = await service.getMetrics();
    const lines = output.split('\n').filter((line) => line.startsWith('voltx_workflow_plan'));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const labels = /\{([^}]*)\}/.exec(line)?.[1] ?? '';
      const names = labels
        .split(',')
        .map((pair) => pair.split('=')[0].trim())
        .filter(Boolean);
      expect(
        names.every((name) => ['category', 'priority', 'status', 'result', 'le'].includes(name)),
      ).toBe(true);
      expect(line).not.toContain(TENANT);
      expect(line).not.toContain(USER);
      expect(line).not.toContain('approval-1');
      expect(line).not.toContain('workflow-1');
    }
  });
});
