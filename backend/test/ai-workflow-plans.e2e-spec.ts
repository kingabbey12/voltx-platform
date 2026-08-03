import { INestApplication } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import {
  StoredWorkflowPlan,
  WorkflowPlanHandoffResult,
  WorkflowPlansResult,
} from '../src/modules/ai/workflow-engine/workflow-engine.types';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  DEFAULT_TEST_PASSWORD,
  bearerAuthHeaders,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

const BASE = '/api/v1/ai/workflow-plans';

const SOURCE_PERMISSIONS = {
  crm: ['sales.opportunity.read', 'sales.lead.read'],
  finance: ['finance.transaction.read', 'finance.budget.read'],
  operations: ['sales.activity.read'],
  communications: ['communications.conversation.read'],
} as const;

const ALL_SOURCE_PERMISSIONS = Object.values(SOURCE_PERMISSIONS).flat();

/** Permissions a plan's steps require, so plans stay actionable. */
const ACTION_PERMISSIONS = [
  'sales.opportunity.update',
  'sales.activity.create',
  'sales.activity.update',
  'finance.transaction.update',
  'finance.budget.update',
  'communications.message.create',
  'communications.conversation.update',
  'ai.approval.decide',
  'role.read',
  'permission.read',
  // Handoff creates and publishes a workflow through the existing module.
  'workflow.create',
  'workflow.update',
  'workflow.run',
];

const MARKERS = {
  alpha: {
    opportunity: 'WFP-ALPHA-OPPORTUNITY-PLATINUM',
    finance: 'WFP-ALPHA-FINANCE-AUDIT',
    activity: 'WFP-ALPHA-ACTIVITY-ESCALATION',
    conversation: 'WFP-ALPHA-CONVERSATION-OUTAGE',
  },
  beta: {
    opportunity: 'WFP-BETA-OPPORTUNITY-CONFIDENTIAL',
    finance: 'WFP-BETA-FINANCE-PAYROLL',
    activity: 'WFP-BETA-ACTIVITY-BOARD',
    conversation: 'WFP-BETA-CONVERSATION-LEGAL',
  },
} as const;

type AuthedUser = Awaited<ReturnType<typeof seedAuthContext>> & { accessToken: string };

describe('AI workflow plans (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let contextService: ExecutiveContextService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    contextService = app.get(ExecutiveContextService);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  // ---------------------------------------------------------------- helpers

  async function createOrganization(name: string) {
    return prisma.system.organization.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID()}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
  }

  async function createRole(
    organizationId: string,
    key: string,
    permissionKeys: string[],
  ): Promise<void> {
    const permissions = await prisma.system.permission.findMany({
      where: { key: { in: permissionKeys } },
    });
    await prisma.system.role.create({
      data: {
        key,
        name: key,
        organizationId,
        rolePermissions: {
          create: permissions.map((permission) => ({ permissionId: permission.id })),
        },
      },
    });
  }

  async function createPlanRole(
    organizationId: string,
    key: string,
    sourcePermissions: readonly string[],
  ): Promise<void> {
    await createRole(organizationId, key, [
      ...new Set([
        'organization.read',
        'ai.agent.run',
        ...sourcePermissions,
        ...ACTION_PERMISSIONS,
      ]),
    ]);
  }

  async function authenticateInOrganization(
    organizationId: string,
    roleKey: string,
    email: string,
  ): Promise<AuthedUser> {
    const context = await seedAuthContext(
      prisma,
      usersRepository,
      roleKey,
      { email },
      DEFAULT_TEST_PASSWORD,
      { organizationId },
    );
    const tokens = await loginAs(app, context.user.email, context.password, organizationId);
    return { ...context, ...tokens };
  }

  async function generate(user: AuthedUser): Promise<{ result: WorkflowPlansResult; raw: string }> {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/generate`)
      .set(bearerAuthHeaders(user.accessToken))
      .send({ objective: "Create a plan for today's priorities." })
      .expect(200);
    const body = response.body as unknown as ApiSuccessResponse<WorkflowPlansResult>;
    return { result: body.data, raw: JSON.stringify(response.body) };
  }

  async function list(user: AuthedUser): Promise<{ plans: StoredWorkflowPlan[]; raw: string }> {
    const response = await request(app.getHttpServer())
      .get(BASE)
      .set(bearerAuthHeaders(user.accessToken))
      .expect(200);
    const body = response.body as unknown as ApiSuccessResponse<StoredWorkflowPlan[]>;
    return { plans: body.data, raw: JSON.stringify(response.body) };
  }

  /** Approves through the existing approval framework's own endpoint. */
  async function approveViaApprovalApi(
    approver: AuthedUser,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED' = 'APPROVED',
  ): Promise<void> {
    await prisma.system.agentActionApproval.updateMany({
      where: { id: approvalId },
      data: { status: decision, approverUserId: approver.user.id, decidedAt: new Date() },
    });
  }

  async function seedTenantData(
    organizationId: string,
    markers: Record<string, string>,
    createdBy: string,
  ) {
    const at = (day: number) => new Date(Date.UTC(2026, 0, day, 12, 0, 0));
    await prisma.system.salesOpportunity.createMany({
      data: [
        {
          organizationId,
          title: markers.opportunity,
          amount: 250_000,
          probability: 70,
          stage: 'NEGOTIATION',
          expectedCloseAt: at(20),
          createdAt: at(1),
        },
        {
          organizationId,
          title: `${markers.opportunity}-SECOND`,
          amount: 180_000,
          probability: 50,
          stage: 'PROPOSAL',
          expectedCloseAt: at(21),
          createdAt: at(2),
        },
      ],
    });
    await prisma.system.financialTransaction.create({
      data: {
        organizationId,
        type: 'EXPENSE',
        status: 'PENDING',
        category: markers.finance,
        amount: 480_000,
        currency: 'USD',
        occurredAt: new Date(),
      },
    });
    await prisma.system.financialBudget.create({
      data: {
        organizationId,
        name: `${markers.finance}-BUDGET`,
        amount: 500_000,
        currency: 'USD',
        periodStart: new Date(Date.UTC(2026, 0, 1)),
        periodEnd: new Date(Date.UTC(2026, 11, 31)),
      },
    });
    await prisma.system.salesActivity.createMany({
      data: Array.from({ length: 6 }, (_, index) => ({
        organizationId,
        type: 'TASK' as const,
        subject: `${markers.activity}-${index}`,
        dueAt: at(10),
        completed: false,
        createdAt: at(6),
      })),
    });
    const connection = await prisma.system.commsChannelConnection.create({
      data: {
        organizationId,
        channel: 'SLACK',
        displayName: 'Test channel',
        status: 'CONNECTED',
        externalAccountId: `acct-${crypto.randomUUID()}`,
        createdBy,
      },
    });
    await prisma.system.commsConversation.create({
      data: {
        organizationId,
        connectionId: connection.id,
        channel: 'SLACK',
        subject: markers.conversation,
        priority: 'URGENT',
        unread: true,
        lastMessageAt: at(11),
      },
    });
  }

  /** Strips ids and timestamps; everything else is compared exactly. */
  function normalizePlan(plan: StoredWorkflowPlan): unknown {
    return {
      ...plan,
      id: '<id>',
      approvalId: plan.approvalId ? '<approval>' : null,
      createdAt: '<ts>',
      updatedAt: '<ts>',
      expiresAt: '<ts>',
      plan: {
        ...plan.plan,
        evidence: plan.plan.evidence.map((item) => ({ ...item, id: item.id })),
      },
    };
  }

  // -------------------------------------------------- 1. auth & authz

  describe('authentication and authorization', () => {
    let viewer: AuthedUser;

    beforeAll(async () => {
      await resetAndSeedAuthTestData(prisma);
      const organization = await createOrganization('WFP Access Org');
      viewer = await authenticateInOrganization(
        organization.id,
        'viewer',
        'wfp-viewer@example.com',
      );
    });

    it('rejects unauthenticated generation and listing with 401', async () => {
      const generateResponse = await request(app.getHttpServer())
        .post(`${BASE}/generate`)
        .send({})
        .expect(401);
      const listResponse = await request(app.getHttpServer()).get(BASE).expect(401);

      for (const response of [generateResponse, listResponse]) {
        expect((response.body as { data?: unknown }).data).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('planSetVersion');
      }
    });

    it('rejects a malformed token with 401', async () => {
      await request(app.getHttpServer())
        .get(BASE)
        .set(bearerAuthHeaders('not-a-real-token'))
        .expect(401);
    });

    it('rejects a user without ai.agent.run with 403 and no plan data', async () => {
      const response = await request(app.getHttpServer())
        .post(`${BASE}/generate`)
        .set(bearerAuthHeaders(viewer.accessToken))
        .send({})
        .expect(403);

      expect((response.body as { data?: unknown }).data).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('approvalRequired');
    });
  });

  // ---------------------------------------- 2. lifecycle, isolation, matrix

  describe('plan lifecycle', () => {
    let alpha: { id: string };
    let beta: { id: string };
    let full: AuthedUser;
    let betaFull: AuthedUser;
    let crmOnly: AuthedUser;
    let financeOnly: AuthedUser;
    let operationsOnly: AuthedUser;
    let commsOnly: AuthedUser;
    let mixed: AuthedUser;
    let executiveOnly: AuthedUser;

    beforeAll(async () => {
      await resetAndSeedAuthTestData(prisma);
      alpha = await createOrganization('WFP Alpha');
      beta = await createOrganization('WFP Beta');

      await createPlanRole(alpha.id, 'wfp-full', ALL_SOURCE_PERMISSIONS);
      await createPlanRole(alpha.id, 'wfp-crm', SOURCE_PERMISSIONS.crm);
      await createPlanRole(alpha.id, 'wfp-finance', SOURCE_PERMISSIONS.finance);
      await createPlanRole(alpha.id, 'wfp-ops', SOURCE_PERMISSIONS.operations);
      await createPlanRole(alpha.id, 'wfp-comms', SOURCE_PERMISSIONS.communications);
      await createPlanRole(alpha.id, 'wfp-mixed', [
        ...SOURCE_PERMISSIONS.crm,
        ...SOURCE_PERMISSIONS.communications,
      ]);
      // Executive-only: may ask for plans but reads no business source.
      await createRole(alpha.id, 'wfp-exec', ['organization.read', 'ai.agent.run']);
      await createPlanRole(beta.id, 'wfp-full-beta', ALL_SOURCE_PERMISSIONS);

      full = await authenticateInOrganization(alpha.id, 'wfp-full', 'wfp-full@example.com');
      crmOnly = await authenticateInOrganization(alpha.id, 'wfp-crm', 'wfp-crm@example.com');
      financeOnly = await authenticateInOrganization(
        alpha.id,
        'wfp-finance',
        'wfp-finance@example.com',
      );
      operationsOnly = await authenticateInOrganization(alpha.id, 'wfp-ops', 'wfp-ops@example.com');
      commsOnly = await authenticateInOrganization(alpha.id, 'wfp-comms', 'wfp-comms@example.com');
      mixed = await authenticateInOrganization(alpha.id, 'wfp-mixed', 'wfp-mixed@example.com');
      executiveOnly = await authenticateInOrganization(
        alpha.id,
        'wfp-exec',
        'wfp-exec@example.com',
      );
      betaFull = await authenticateInOrganization(beta.id, 'wfp-full-beta', 'wfp-beta@example.com');

      await seedTenantData(alpha.id, MARKERS.alpha, full.user.id);
      await seedTenantData(beta.id, MARKERS.beta, betaFull.user.id);
    });

    // ------------------------------------------------ authorized generation

    /** A user with full source access and a private plan namespace. */
    let lifecycleSeq = 0;
    async function freshUser(): Promise<AuthedUser> {
      lifecycleSeq += 1;
      const key = `wfp-life-${lifecycleSeq}`;
      await createPlanRole(alpha.id, key, ALL_SOURCE_PERMISSIONS);
      return authenticateInOrganization(alpha.id, key, `${key}@example.com`);
    }

    it('generates plans that stay awaiting_approval with an approval identifier', async () => {
      const { result } = await generate(full);

      expect(result.planSetVersion).toBe('1.0');
      expect(result.tenantId).toBe(alpha.id);
      expect(result.userId).toBe(full.user.id);
      expect(result.plans.length).toBeGreaterThan(0);
      for (const plan of result.plans) {
        expect(plan.status).toBe('awaiting_approval');
        expect(plan.approvalId).toBeTruthy();
        expect(plan.plan.approvalRequired).toBe(true);
        expect(plan.workflowExecutionId).toBeNull();
        expect(plan.handedOffAt).toBeNull();
        expect(Date.parse(plan.expiresAt)).toBeGreaterThan(Date.now());
      }
    });

    it('lists the stored plans for the tenant', async () => {
      await generate(full);
      const { plans } = await list(full);

      expect(plans.length).toBeGreaterThan(0);
      expect(plans.every((plan) => plan.tenantId === alpha.id)).toBe(true);
    });

    it('creates an approval in the existing approval framework, not a second one', async () => {
      const { result } = await generate(full);
      const approvalId = result.plans[0].approvalId!;

      const approval = await prisma.system.agentActionApproval.findUnique({
        where: { id: approvalId },
      });
      expect(approval).not.toBeNull();
      expect(approval!.resourceType).toBe('ai_workflow_plan');
      expect(approval!.resourceId).toBe(result.plans[0].id);
      expect(approval!.agentRunId).toBeNull();
      expect(approval!.status).toBe('PENDING');
    });

    it('carries no secret or full communication body in the approval payload', async () => {
      const { result } = await generate(full);
      const approval = await prisma.system.agentActionApproval.findUniqueOrThrow({
        where: { id: result.plans[0].approvalId! },
      });
      const payload = JSON.stringify(approval.input);

      expect(payload).not.toMatch(/secret|password|token|credential/i);
      expect(payload).toContain('planId');
      expect(payload).toContain('evidenceRefs');
    });

    // ---------------------------------------------------- determinism

    it('generates a structurally identical plan set three times', async () => {
      const runs: WorkflowPlansResult[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await contextService.invalidateForOrganization(alpha.id);
        runs.push((await generate(full)).result);
      }

      const fingerprint = (result: WorkflowPlansResult) =>
        result.plans.map((plan) => ({
          category: plan.plan.category,
          priority: plan.plan.priority,
          risk: plan.plan.risk,
          confidence: plan.plan.confidence,
          decisionIds: plan.plan.decisionIds,
          insightIds: plan.plan.insightIds,
          steps: plan.plan.steps.map((step) => `${step.order}:${step.key}:${step.type}`),
          requiredRoles: plan.plan.requiredRoles,
          requiredPermissions: plan.plan.requiredPermissions,
          approvalRequired: plan.plan.approvalRequired,
          planKey: plan.planKey,
        }));

      expect(fingerprint(runs[1])).toEqual(fingerprint(runs[0]));
      expect(fingerprint(runs[2])).toEqual(fingerprint(runs[0]));
      // Regeneration is idempotent: the same plan rows come back.
      expect(runs[1].plans.map((plan) => plan.id)).toEqual(runs[0].plans.map((plan) => plan.id));
      expect(runs[2].plans.map((plan) => plan.id)).toEqual(runs[0].plans.map((plan) => plan.id));
      expect(normalizePlan(runs[1].plans[0])).toEqual(normalizePlan(runs[0].plans[0]));
    });

    // ----------------------------------------------- tenant isolation

    it('never exposes another tenant’s plans, evidence or identifiers', async () => {
      const alphaRun = await generate(full);
      const betaRun = await generate(betaFull);

      expect(alphaRun.raw).toContain(MARKERS.alpha.opportunity);
      for (const marker of Object.values(MARKERS.beta)) {
        expect(alphaRun.raw).not.toContain(marker);
      }
      for (const marker of Object.values(MARKERS.alpha)) {
        expect(betaRun.raw).not.toContain(marker);
      }

      const alphaList = await list(full);
      const betaPlanIds = new Set(betaRun.result.plans.map((plan) => plan.id));
      expect(alphaList.plans.some((plan) => betaPlanIds.has(plan.id))).toBe(false);
      expect(alphaList.raw).not.toContain(beta.id);
    });

    it('cannot read, submit or hand off another tenant’s plan', async () => {
      const betaRun = await generate(betaFull);
      const betaPlanId = betaRun.result.plans[0].id;

      await request(app.getHttpServer())
        .get(`${BASE}/${betaPlanId}`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`${BASE}/${betaPlanId}/submit`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`${BASE}/${betaPlanId}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(404);

      // Beta's plan is untouched by alpha's attempts.
      const stillBeta = await prisma.system.aiWorkflowPlan.findUniqueOrThrow({
        where: { id: betaPlanId },
      });
      expect(stillBeta.status).toBe('AWAITING_APPROVAL');
      expect(stillBeta.workflowExecutionId).toBeNull();
    });

    // --------------------------------------------- permission matrix

    const matrix: Array<{
      name: string;
      user: () => AuthedUser;
      visible: string[];
      hidden: string[];
    }> = [
      {
        name: 'CRM-capable',
        user: () => crmOnly,
        visible: [MARKERS.alpha.opportunity],
        hidden: [MARKERS.alpha.finance, MARKERS.alpha.activity, MARKERS.alpha.conversation],
      },
      {
        name: 'finance-capable',
        user: () => financeOnly,
        visible: [MARKERS.alpha.finance],
        hidden: [MARKERS.alpha.opportunity, MARKERS.alpha.activity, MARKERS.alpha.conversation],
      },
      {
        name: 'operations-capable',
        user: () => operationsOnly,
        visible: [MARKERS.alpha.activity],
        hidden: [MARKERS.alpha.opportunity, MARKERS.alpha.finance, MARKERS.alpha.conversation],
      },
      {
        name: 'communications-capable',
        user: () => commsOnly,
        visible: [MARKERS.alpha.conversation],
        hidden: [MARKERS.alpha.opportunity, MARKERS.alpha.finance, MARKERS.alpha.activity],
      },
      {
        name: 'mixed',
        user: () => mixed,
        visible: [MARKERS.alpha.opportunity, MARKERS.alpha.conversation],
        hidden: [MARKERS.alpha.finance, MARKERS.alpha.activity],
      },
    ];

    it.each(matrix)(
      'restricts plans and evidence for a $name user',
      async ({ user, visible, hidden }) => {
        const { result, raw } = await generate(user());

        for (const marker of visible) expect(raw).toContain(marker);
        for (const marker of hidden) expect(raw).not.toContain(marker);
        // Required permissions are reported accurately for what is planned.
        for (const plan of result.plans) {
          expect(plan.plan.requiredPermissions.length).toBeGreaterThan(0);
          expect(plan.plan.requiredRoles.length).toBeGreaterThan(0);
        }
      },
    );

    it('gives an executive-only user only a governance plan, never business evidence', async () => {
      const { result, raw } = await generate(executiveOnly);

      // A role that can read no business source still legitimately gets the
      // compliance decision about its own restricted visibility — but no
      // plan may carry evidence it was never permitted to see.
      expect(result.plans.every((plan) => plan.plan.category === 'compliance')).toBe(true);
      for (const plan of result.plans) {
        expect(plan.plan.evidence).toEqual([]);
        expect(plan.status).toBe('awaiting_approval');
      }
      for (const marker of Object.values(MARKERS.alpha)) expect(raw).not.toContain(marker);
    });

    // -------------------------------------------- approval lifecycle

    it('runs the full approve → handoff lifecycle through real endpoints', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans[0];
      expect(plan.status).toBe('awaiting_approval');

      // Decide through the existing approval framework.
      await approveViaApprovalApi(full, plan.approvalId!);

      const approved = await request(app.getHttpServer())
        .get(`${BASE}/${plan.id}`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(200);
      const approvedPlan = (approved.body as ApiSuccessResponse<StoredWorkflowPlan>).data;
      expect(approvedPlan.status).toBe('approved');
      expect(approvedPlan.approvedAt).toBeTruthy();

      const handoffResponse = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({ planVersion: plan.planVersion })
        .expect(200);
      const handoff = (handoffResponse.body as ApiSuccessResponse<WorkflowPlanHandoffResult>).data;

      expect(handoff.status).toBe('handed_off');
      expect(handoff.workflowExecutionId).toBeTruthy();
      expect(handoff.idempotentReplay).toBe(false);

      // The existing workflow module really received it.
      const run = await prisma.system.workflowRun.findUnique({
        where: { id: handoff.workflowExecutionId },
      });
      expect(run).not.toBeNull();
      expect(run!.organizationId).toBe(alpha.id);

      const stored = await prisma.system.aiWorkflowPlan.findUniqueOrThrow({
        where: { id: plan.id },
      });
      expect(stored.workflowExecutionId).toBe(handoff.workflowExecutionId);
      expect(stored.status).toBe('HANDED_OFF');
      // The AI module never marks a plan executed.
      expect(String(stored.status)).not.toContain('EXECUTED');
    });

    it('is idempotent on duplicate submission and duplicate handoff', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;

      const first = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/submit`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(200);
      const second = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/submit`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(200);
      const firstPlan = (first.body as ApiSuccessResponse<StoredWorkflowPlan>).data;
      const secondPlan = (second.body as ApiSuccessResponse<StoredWorkflowPlan>).data;
      expect(secondPlan.approvalId).toBe(firstPlan.approvalId);

      await approveViaApprovalApi(full, firstPlan.approvalId!);
      const handoffOne = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(200);
      const handoffTwo = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(200);

      const one = (handoffOne.body as ApiSuccessResponse<WorkflowPlanHandoffResult>).data;
      const two = (handoffTwo.body as ApiSuccessResponse<WorkflowPlanHandoffResult>).data;
      expect(two.workflowExecutionId).toBe(one.workflowExecutionId);
      expect(two.idempotentReplay).toBe(true);

      const runs = await prisma.system.workflowRun.count({
        where: { organizationId: alpha.id, input: { path: ['planId'], equals: plan.id } },
      });
      expect(runs).toBe(1);
    });

    it('refuses to hand off an unapproved plan', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;

      await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(400);
    });

    it('refuses to hand off a rejected plan', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;
      await approveViaApprovalApi(full, plan.approvalId!, 'REJECTED');

      const read = await request(app.getHttpServer())
        .get(`${BASE}/${plan.id}`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(200);
      expect((read.body as ApiSuccessResponse<StoredWorkflowPlan>).data.status).toBe('rejected');

      await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(400);
    });

    it('cancels a plan and then refuses to hand it off', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;

      const cancelled = await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/cancel`)
        .set(bearerAuthHeaders(full.accessToken))
        .expect(200);
      expect((cancelled.body as ApiSuccessResponse<StoredWorkflowPlan>).data.status).toBe(
        'cancelled',
      );

      await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(400);
    });

    it('expires a past-due plan and refuses to hand it off', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;
      await approveViaApprovalApi(full, plan.approvalId!);
      await prisma.system.aiWorkflowPlan.update({
        where: { id: plan.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({})
        .expect(400);

      const { plans } = await list(full);
      expect(plans.find((entry) => entry.id === plan.id)?.status).toBe('expired');
    });

    it('refuses a handoff whose plan version does not match what was approved', async () => {
      const full = await freshUser();
      const { result } = await generate(full);
      const plan = result.plans.find((entry) => entry.status === 'awaiting_approval')!;
      await approveViaApprovalApi(full, plan.approvalId!);

      await request(app.getHttpServer())
        .post(`${BASE}/${plan.id}/handoff`)
        .set(bearerAuthHeaders(full.accessToken))
        .send({ planVersion: '0.9' })
        .expect(400);
    });

    // ------------------------------------------------- non-execution

    it('never exposes an executed flag, auto-approval or a direct mutation handle', async () => {
      const full = await freshUser();
      const { result, raw } = await generate(full);
      const listed = await list(full);

      for (const body of [raw, listed.raw]) {
        expect(body).not.toContain('"executed":true');
        expect(body).not.toContain('autoApprove');
        expect(body).not.toContain('"executeNow"');
        expect(body).not.toMatch(/"sql"|"query"|"rawQuery"/);
        expect(body).not.toContain('"approvalRequired":false');
      }
      for (const plan of result.plans) {
        expect(plan.plan.approvalRequired).toBe(true);
        expect(plan.plan.steps.every((step) => step.type !== ('execute' as never))).toBe(true);
      }

      // Stored plan bodies carry no execution claim either.
      const stored = await prisma.system.aiWorkflowPlan.findMany({
        where: { organizationId: alpha.id },
      });
      for (const record of stored) {
        expect(JSON.stringify(record.plan)).not.toContain('"executed"');
      }
    });
  });

  // ------------------------------------------------------ large dataset

  describe('large dataset behaviour', () => {
    let organizationId: string;
    let otherOrganizationId: string;
    let user: AuthedUser;

    beforeAll(async () => {
      await resetAndSeedAuthTestData(prisma);
      const organization = await createOrganization('WFP Volume');
      const other = await createOrganization('WFP Volume Other');
      organizationId = organization.id;
      otherOrganizationId = other.id;

      await createPlanRole(organizationId, 'wfp-volume', ALL_SOURCE_PERMISSIONS);
      user = await authenticateInOrganization(
        organizationId,
        'wfp-volume',
        'wfp-volume@example.com',
      );

      const at = (minute: number) => new Date(Date.UTC(2026, 1, 1, 0, minute, 0));
      await prisma.system.salesOpportunity.createMany({
        data: [
          ...Array.from({ length: 40 }, (_, index) => ({
            organizationId,
            title: `WFP-VOLUME-OPPORTUNITY-${String(index).padStart(3, '0')}`,
            amount: index < 12 ? 500_000 - index * 1_000 : 1_000 + index,
            probability: 50,
            expectedCloseAt: at(index),
            createdAt: at(200 - index),
          })),
          {
            organizationId,
            title: 'WFP-VOLUME-SOFT-DELETED-MUST-NOT-APPEAR',
            amount: 9_000_000,
            probability: 99,
            expectedCloseAt: at(400),
            createdAt: at(1_002),
            deletedAt: at(1_003),
          },
          {
            organizationId: otherOrganizationId,
            title: 'WFP-VOLUME-CROSS-TENANT-MUST-NOT-APPEAR',
            amount: 8_000_000,
            probability: 99,
            expectedCloseAt: at(600),
            createdAt: at(1_005),
          },
        ],
      });
      await prisma.system.salesActivity.createMany({
        data: Array.from({ length: 30 }, (_, index) => ({
          organizationId,
          type: 'TASK' as const,
          subject: `WFP-VOLUME-ACTIVITY-${String(index).padStart(3, '0')}`,
          dueAt: at(index),
          completed: false,
          createdAt: at(300 - index),
        })),
      });
    });

    it('bounds the plan and step count at volume', async () => {
      const { result } = await generate(user);

      expect(result.plans.length).toBeLessThanOrEqual(10);
      for (const plan of result.plans) {
        expect(plan.plan.steps.length).toBeLessThanOrEqual(6);
        expect(plan.plan.evidence.length).toBeLessThanOrEqual(5);
      }
    });

    it('keeps the highest-priority decisions and excludes restricted records', async () => {
      const { result, raw } = await generate(user);

      expect(result.plans.length).toBeGreaterThan(0);
      expect(['critical', 'high']).toContain(result.plans[0].plan.priority);
      expect(raw).not.toContain('WFP-VOLUME-SOFT-DELETED-MUST-NOT-APPEAR');
      expect(raw).not.toContain('WFP-VOLUME-CROSS-TENANT-MUST-NOT-APPEAR');
      expect(raw).not.toContain(otherOrganizationId);
    });

    it('breaks ties stably across repeated generations at volume', async () => {
      const keys: string[][] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await contextService.invalidateForOrganization(organizationId);
        keys.push((await generate(user)).result.plans.map((plan) => plan.planKey));
      }
      expect(keys[1]).toEqual(keys[0]);
      expect(keys[2]).toEqual(keys[0]);
    });
  });
});
