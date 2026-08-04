import { INestApplication } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import {
  BusinessIntelligenceResult,
  BusinessIntelligenceScore,
} from '../src/modules/business-intelligence/business-intelligence.types';
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

const URL = '/api/v1/business-intelligence';
const SOURCE_PERMISSIONS = {
  crm: ['sales.opportunity.read', 'sales.lead.read'],
  finance: ['finance.transaction.read', 'finance.budget.read'],
  operations: ['sales.activity.read'],
  communications: ['communications.conversation.read'],
} as const;
const ALL_SOURCE_PERMISSIONS = Object.values(SOURCE_PERMISSIONS).flat();
const MARKERS = {
  alpha: {
    opportunity: 'TENANT_A_PIPELINE_MARKER',
    finance: 'TENANT_A_FINANCE_MARKER',
    activity: 'TENANT_A_OPERATIONS_MARKER',
    conversation: 'TENANT_A_COMMS_MARKER',
  },
  beta: {
    opportunity: 'TENANT_B_PIPELINE_MARKER',
    finance: 'TENANT_B_FINANCE_MARKER',
    activity: 'TENANT_B_OPERATIONS_MARKER',
    conversation: 'TENANT_B_COMMS_MARKER',
  },
} as const;
type AuthedUser = Awaited<ReturnType<typeof seedAuthContext>> & { accessToken: string };

describe('Business Intelligence HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let users: UsersRepository;
  let contextService: ExecutiveContextService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    users = app.get(UsersRepository);
    contextService = app.get(ExecutiveContextService);
  }, 60_000);
  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function org(name: string) {
    return prisma.system.organization.create({
      data: {
        name,
        slug: `${name.toLowerCase()}-${crypto.randomUUID()}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
  }
  async function role(organizationId: string, key: string, permissionKeys: readonly string[]) {
    const permissions = await prisma.system.permission.findMany({
      where: { key: { in: [...permissionKeys] } },
    });
    if (permissions.length !== new Set(permissionKeys).size)
      throw new Error(`unknown permissions for ${key}`);
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
  async function user(organizationId: string, roleKey: string, email: string): Promise<AuthedUser> {
    const context = await seedAuthContext(
      prisma,
      users,
      roleKey,
      { email },
      DEFAULT_TEST_PASSWORD,
      { organizationId },
    );
    return {
      ...context,
      ...(await loginAs(app, context.user.email, context.password, organizationId)),
    };
  }
  async function get(user: AuthedUser, path = URL, status = 200) {
    return request(app.getHttpServer())
      .get(path)
      .set(bearerAuthHeaders(user.accessToken))
      .expect(status);
  }
  async function result(
    user: AuthedUser,
  ): Promise<{ value: BusinessIntelligenceResult; raw: string }> {
    const response = await get(user);
    return {
      value: (response.body as ApiSuccessResponse<BusinessIntelligenceResult>).data,
      raw: JSON.stringify(response.body),
    };
  }
  async function seed(
    organizationId: string,
    values: (typeof MARKERS)['alpha'] | (typeof MARKERS)['beta'],
    ownerId: string,
    extras = false,
  ) {
    const now = new Date('2026-08-03T12:00:00.000Z');
    await prisma.system.salesOpportunity.createMany({
      data: [
        {
          organizationId,
          title: values.opportunity,
          amount: 200000,
          probability: 70,
          stage: 'NEGOTIATION',
          expectedCloseAt: now,
        },
        ...(extras
          ? Array.from({ length: 24 }, (_, index) => ({
              organizationId,
              title: `BOUND-${index}`,
              amount: index === 0 ? 300000 : 1,
              probability: 50,
              stage: 'PROPOSAL' as const,
              expectedCloseAt: now,
            }))
          : []),
      ],
    });
    await prisma.system.financialTransaction.create({
      data: {
        organizationId,
        type: 'EXPENSE',
        status: 'PENDING',
        category: values.finance,
        amount: 100,
        currency: 'USD',
        occurredAt: now,
      },
    });
    await prisma.system.salesActivity.create({
      data: {
        organizationId,
        type: 'TASK',
        subject: values.activity,
        completed: false,
        dueAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });
    const connection = await prisma.system.commsChannelConnection.create({
      data: {
        organizationId,
        channel: 'SLACK',
        displayName: 'E2E',
        status: 'CONNECTED',
        externalAccountId: crypto.randomUUID(),
        createdBy: ownerId,
      },
    });
    await prisma.system.commsConversation.create({
      data: {
        organizationId,
        connectionId: connection.id,
        channel: 'SLACK',
        subject: values.conversation,
        priority: 'URGENT',
        unread: true,
      },
    });
  }
  const score = (value: BusinessIntelligenceResult, id: BusinessIntelligenceScore['id']) =>
    id === 'executive_health'
      ? value.executiveHealth
      : value.departments.find((item) => item.id === id)!;
  function normalized(value: BusinessIntelligenceResult) {
    return {
      executive: { ...value.executiveHealth, generatedAt: '<timestamp>' },
      departments: value.departments.map((item) => ({ ...item, generatedAt: '<timestamp>' })),
      excludedSources: value.excludedSources,
    };
  }

  describe('authentication and isolated response', () => {
    let alpha: { id: string };
    let beta: { id: string };
    let full: AuthedUser;
    let crm: AuthedUser;
    let finance: AuthedUser;
    let operations: AuthedUser;
    let communications: AuthedUser;
    let none: AuthedUser;
    let crmCommunications: AuthedUser;
    let financeOperations: AuthedUser;
    let crmFinanceCommunications: AuthedUser;
    let betaFull: AuthedUser;
    let viewer: AuthedUser;
    beforeAll(async () => {
      await resetAndSeedAuthTestData(prisma);
      alpha = await org('Alpha');
      beta = await org('Beta');
      const permissions = (source: readonly string[]) =>
        ['organization.read', 'ai.agent.run', ...source] as const;
      await role(alpha.id, 'bi-full', permissions(ALL_SOURCE_PERMISSIONS));
      await role(alpha.id, 'bi-crm', permissions(SOURCE_PERMISSIONS.crm));
      await role(alpha.id, 'bi-finance', permissions(SOURCE_PERMISSIONS.finance));
      await role(alpha.id, 'bi-operations', permissions(SOURCE_PERMISSIONS.operations));
      await role(alpha.id, 'bi-comms', permissions(SOURCE_PERMISSIONS.communications));
      await role(alpha.id, 'bi-none', permissions([]));
      await role(
        alpha.id,
        'bi-crm-comms',
        permissions([...SOURCE_PERMISSIONS.crm, ...SOURCE_PERMISSIONS.communications]),
      );
      await role(
        alpha.id,
        'bi-finance-operations',
        permissions([...SOURCE_PERMISSIONS.finance, ...SOURCE_PERMISSIONS.operations]),
      );
      await role(
        alpha.id,
        'bi-crm-finance-comms',
        permissions([
          ...SOURCE_PERMISSIONS.crm,
          ...SOURCE_PERMISSIONS.finance,
          ...SOURCE_PERMISSIONS.communications,
        ]),
      );
      await role(beta.id, 'bi-full-beta', permissions(ALL_SOURCE_PERMISSIONS));
      full = await user(alpha.id, 'bi-full', 'bi-full@alpha.test');
      crm = await user(alpha.id, 'bi-crm', 'bi-crm@alpha.test');
      finance = await user(alpha.id, 'bi-finance', 'bi-finance@alpha.test');
      operations = await user(alpha.id, 'bi-operations', 'bi-ops@alpha.test');
      communications = await user(alpha.id, 'bi-comms', 'bi-comms@alpha.test');
      none = await user(alpha.id, 'bi-none', 'bi-none@alpha.test');
      betaFull = await user(beta.id, 'bi-full-beta', 'bi-full@beta.test');
      crmCommunications = await user(alpha.id, 'bi-crm-comms', 'bi-crm-comms@alpha.test');
      financeOperations = await user(
        alpha.id,
        'bi-finance-operations',
        'bi-finance-ops@alpha.test',
      );
      crmFinanceCommunications = await user(
        alpha.id,
        'bi-crm-finance-comms',
        'bi-crm-finance-comms@alpha.test',
      );
      viewer = await user(alpha.id, 'viewer', 'bi-viewer@alpha.test');
      await seed(alpha.id, MARKERS.alpha, full.user.id, true);
      await seed(beta.id, MARKERS.beta, betaFull.user.id);
    }, 60_000);

    it('returns safe 401/403 responses before any BI payload', async () => {
      for (const response of [
        await request(app.getHttpServer()).get(URL).expect(401),
        await request(app.getHttpServer()).get(URL).set(bearerAuthHeaders('invalid')).expect(401),
        await get(viewer, URL, 403),
      ]) {
        const raw = JSON.stringify(response.body);
        expect(raw).not.toContain('formulaVersion');
        expect(raw).not.toContain('evidence');
        expect(raw).not.toContain(alpha.id);
      }
    });

    it('returns the complete normalized contract without non-finite values', async () => {
      const { value, raw } = await result(full);
      expect(value.version).toBe('1.0');
      expect(Date.parse(value.generatedAt)).not.toBeNaN();
      expect(value.departments).toHaveLength(6);
      for (const item of [value.executiveHealth, ...value.departments]) {
        for (const key of [
          'id',
          'category',
          'status',
          'score',
          'confidence',
          'formulaVersion',
          'formula',
          'weights',
          'inputs',
          'evidence',
          'sourceModules',
          'excludedSources',
          'reasoning',
          'generatedAt',
          'trendStatus',
          'trendReason',
        ])
          expect(item).toHaveProperty(key);
        expect(item.trendStatus).toBe('unavailable');
        expect(item.trendReason).toBe('historical_source_unavailable');
      }
      expect(raw).not.toMatch(/NaN|Infinity|undefined|previousPeriod|monthOverMonth|growthRate/);
    });

    it.each([
      [
        'CRM',
        () => crm,
        'sales_health',
        [MARKERS.alpha.opportunity],
        [MARKERS.alpha.finance, MARKERS.alpha.activity, MARKERS.alpha.conversation],
      ],
      [
        'Finance',
        () => finance,
        'financial_health',
        [MARKERS.alpha.finance],
        [MARKERS.alpha.opportunity, MARKERS.alpha.activity, MARKERS.alpha.conversation],
      ],
      [
        'Operations',
        () => operations,
        'operations_health',
        [MARKERS.alpha.activity],
        [MARKERS.alpha.opportunity, MARKERS.alpha.finance, MARKERS.alpha.conversation],
      ],
      [
        'Communications',
        () => communications,
        'communications_health',
        [MARKERS.alpha.conversation],
        [MARKERS.alpha.opportunity, MARKERS.alpha.finance, MARKERS.alpha.activity],
      ],
    ] as const)(
      '%s-only exposes only the permitted source',
      async (name, identity, available, visible, hidden) => {
        const { value, raw } = await result(identity());
        expect(score(value, available).score).not.toBeNull();
        const alsoAvailable = name === 'Communications' ? ['customer_success_health'] : [];
        for (const department of value.departments.filter(
          (item) => item.id !== available && !alsoAvailable.includes(item.id),
        ))
          expect(department).toMatchObject({ status: 'unavailable', score: null });
        for (const marker of visible) expect(raw).toContain(marker);
        for (const marker of hidden) expect(raw).not.toContain(marker);
        expect(raw).not.toContain('sales.opportunity.read');
      },
    );

    it('prevents tenant leakage in both directions and keeps bounded ranked evidence deterministic', async () => {
      const alphaResponse = await result(full);
      const betaResponse = await result(betaFull);
      for (const marker of Object.values(MARKERS.beta))
        expect(alphaResponse.raw).not.toContain(marker);
      for (const marker of Object.values(MARKERS.alpha))
        expect(betaResponse.raw).not.toContain(marker);
      const first = await result(full);
      const second = await result(full);
      const third = await result(full);
      expect(normalized(first.value)).toEqual(normalized(second.value));
      expect(normalized(second.value)).toEqual(normalized(third.value));
      const sales = score(first.value, 'sales_health');
      expect(sales.evidence.length).toBeLessThanOrEqual(20);
      expect(sales.evidence.map((item) => item.label)).toContain(MARKERS.alpha.opportunity);
      expect(sales.evidence[0].priority).toBe('high');
    });

    it('keeps all scores and Executive Health unavailable when no BI source is permitted', async () => {
      const { value, raw } = await result(none);
      for (const item of [value.executiveHealth, ...value.departments])
        expect(item).toMatchObject({ status: 'unavailable', score: null });
      expect(raw).not.toMatch(/NaN|TENANT_A_/);
    });

    it.each([
      [
        'CRM + Communications',
        () => crmCommunications,
        ['sales_health', 'customer_success_health', 'communications_health'],
        [MARKERS.alpha.finance, MARKERS.alpha.activity],
      ],
      [
        'Finance + Operations',
        () => financeOperations,
        ['financial_health', 'operations_health'],
        [MARKERS.alpha.opportunity, MARKERS.alpha.conversation],
      ],
      [
        'CRM + Finance + Communications',
        () => crmFinanceCommunications,
        ['financial_health', 'sales_health', 'customer_success_health', 'communications_health'],
        [MARKERS.alpha.activity],
      ],
    ] as const)(
      '%s has the exact available score set and average',
      async (_name, identity, availableIds: readonly string[], hidden: readonly string[]) => {
        const { value, raw } = await result(identity());
        const available = value.departments.filter((item) => item.score !== null);
        expect(available.map((item) => item.id)).toEqual(availableIds);

        // Customer Success Health and Communications Health both score from the
        // single `communications` section. Averaging over every available
        // department therefore let that one source vote twice — this assertion
        // previously reproduced that bug rather than catching it, which is why
        // it went unnoticed. Executive Health counts each distinct source set
        // once, so the expectation must too.
        const seen = new Set<string>();
        const contributing = available.filter((item) => {
          const signature = [...item.sourceModules].sort().join('|');
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        });
        expect(value.executiveHealth.score).toBe(
          Math.round(
            contributing.reduce((sum, item) => sum + item.score!, 0) / contributing.length,
          ),
        );
        expect(new Set(value.executiveHealth.sourceModules).size).toBe(
          value.executiveHealth.sourceModules.length,
        );
        for (const item of value.departments.filter(
          (department) => !availableIds.includes(department.id),
        ))
          expect(item).toMatchObject({ score: null, status: 'unavailable' });
        for (const marker of hidden) expect(raw).not.toContain(marker);
        expect(raw).not.toMatch(
          /sales\.opportunity\.read|finance\.transaction\.read|communications\.conversation\.read/,
        );
      },
    );

    it('proves exact HTTP scores for no deductions, one high, one critical, one critical plus one high, and the floor', async () => {
      // Every deduction below is produced by a real record travelling the
      // whole path — Workflow Provider -> Operations Context -> Executive
      // Context -> Business Intelligence. Nothing is mocked or injected.
      //
      // The verified operations severity contract (pinned in
      // test/operations-context-severity.spec.ts) is:
      //   no/future open activity -> medium (no deduction)
      //   overdue open activity   -> high   (-10)
      //   FAILED workflow run     -> critical (-25)
      // so a critical deduction requires a genuine failed run, not an
      // overdue activity.
      const formulaOrg = await org('Formula');
      await role(formulaOrg.id, 'bi-formula-crm', [
        'organization.read',
        'ai.agent.run',
        ...SOURCE_PERMISSIONS.crm,
      ]);
      // workflow.read lets the operations provider collect failed runs; it
      // opens no additional context source.
      await role(formulaOrg.id, 'bi-formula-operations', [
        'organization.read',
        'ai.agent.run',
        ...SOURCE_PERMISSIONS.operations,
        'workflow.read',
      ]);
      const formulaCrm = await user(formulaOrg.id, 'bi-formula-crm', 'formula-crm@example.com');
      const formulaOperations = await user(
        formulaOrg.id,
        'bi-formula-operations',
        'formula-operations@example.com',
      );
      const date = new Date('2026-08-03T00:00:00.000Z');

      /** Builds Workflow -> WorkflowVersion -> Conversation -> WorkflowRun(FAILED). */
      async function seedFailedWorkflowRun(label: string): Promise<void> {
        const workflow = await prisma.system.workflow.create({
          data: {
            organizationId: formulaOrg.id,
            name: `${label}-${crypto.randomUUID()}`,
            status: 'PUBLISHED',
            publishedVersion: 1,
            createdBy: formulaOperations.user.id,
          },
        });
        const version = await prisma.system.workflowVersion.create({
          data: {
            organizationId: formulaOrg.id,
            workflowId: workflow.id,
            version: 1,
            definition: {
              steps: [
                {
                  id: 'notify',
                  name: 'Notify',
                  type: 'NOTIFICATION',
                  config: { channel: 'log', message: label },
                },
              ],
            },
            createdBy: formulaOperations.user.id,
          },
        });
        const conversation = await prisma.system.conversation.create({
          data: {
            organizationId: formulaOrg.id,
            userId: formulaOperations.user.id,
            title: `${label} run`,
            model: 'test-model',
            provider: 'test-provider',
          },
        });
        await prisma.system.workflowRun.create({
          data: {
            organizationId: formulaOrg.id,
            workflowId: workflow.id,
            workflowVersionId: version.id,
            conversationId: conversation.id,
            status: 'FAILED',
            triggerType: 'API',
            error: `${label} failed`,
          },
        });
      }

      const operationsScore = async () => {
        await contextService.invalidateForOrganization(formulaOrg.id);
        return score((await result(formulaOperations)).value, 'operations_health');
      };

      /** Every score the API returns must be finite, non-negative and explained. */
      function assertWellFormed(entry: BusinessIntelligenceScore): void {
        expect(Number.isFinite(entry.score)).toBe(true);
        expect(entry.score).toBeGreaterThanOrEqual(0);
        expect(entry.formulaVersion).toBe('1.0');
        const critical = entry.evidence.filter((item) => item.priority === 'critical').length;
        const high = entry.evidence.filter((item) => item.priority === 'high').length;
        // No hidden deductions: the score is exactly what the evidence explains.
        expect(entry.score).toBe(Math.max(0, 100 - critical * 25 - high * 10));
        // No fabricated evidence: every deducting record is really in the set.
        expect(entry.inputs['operations.criticalRecords'] ?? critical).toBe(critical);
        expect(entry.inputs['operations.highPriorityRecords'] ?? high).toBe(high);
      }

      // --- No deductions: a future-dated open activity is medium ----------
      await prisma.system.salesOpportunity.create({
        data: {
          organizationId: formulaOrg.id,
          title: 'FORMULA_NO_DEDUCTION',
          amount: 99_999,
          probability: 50,
          stage: 'PROPOSAL',
          expectedCloseAt: date,
        },
      });
      expect(score((await result(formulaCrm)).value, 'sales_health')).toMatchObject({
        score: 100,
        formulaVersion: '1.0',
      });

      await prisma.system.salesActivity.create({
        data: {
          organizationId: formulaOrg.id,
          type: 'TASK',
          subject: 'FORMULA_FUTURE_ACTIVITY',
          completed: false,
          dueAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      });
      const none = await operationsScore();
      expect(none).toMatchObject({
        score: 100,
        inputs: { 'operations.criticalRecords': 0, 'operations.highPriorityRecords': 0 },
      });
      assertWellFormed(none);

      // --- One high: an overdue open activity ----------------------------
      await prisma.system.salesOpportunity.create({
        data: {
          organizationId: formulaOrg.id,
          title: 'FORMULA_HIGH',
          amount: 100_000,
          probability: 50,
          stage: 'PROPOSAL',
          expectedCloseAt: date,
        },
      });
      await contextService.invalidateForOrganization(formulaOrg.id);
      expect(score((await result(formulaCrm)).value, 'sales_health')).toMatchObject({
        score: 90,
        inputs: { 'crm.highPriorityRecords': 1 },
      });

      const overdue = await prisma.system.salesActivity.create({
        data: {
          organizationId: formulaOrg.id,
          type: 'TASK',
          subject: 'FORMULA_OVERDUE_ACTIVITY',
          completed: false,
          dueAt: new Date('2020-01-01T00:00:00.000Z'),
        },
      });
      const oneHigh = await operationsScore();
      expect(oneHigh).toMatchObject({
        score: 90,
        inputs: { 'operations.criticalRecords': 0, 'operations.highPriorityRecords': 1 },
      });
      assertWellFormed(oneHigh);

      // --- One critical: a real FAILED workflow run, no high --------------
      // Clearing the overdue activity isolates the critical deduction.
      await prisma.system.salesActivity.update({
        where: { id: overdue.id },
        data: { completed: true },
      });
      await seedFailedWorkflowRun('FORMULA_CRITICAL');
      const oneCritical = await operationsScore();
      expect(oneCritical).toMatchObject({
        score: 75,
        inputs: { 'operations.criticalRecords': 1, 'operations.highPriorityRecords': 0 },
      });
      expect(
        oneCritical.evidence.some(
          (item) => item.priority === 'critical' && item.id.startsWith('workflow-run:'),
        ),
      ).toBe(true);
      assertWellFormed(oneCritical);

      // --- One critical + one high ---------------------------------------
      await prisma.system.salesActivity.update({
        where: { id: overdue.id },
        data: { completed: false },
      });
      const criticalAndHigh = await operationsScore();
      expect(criticalAndHigh).toMatchObject({
        score: 65,
        inputs: { 'operations.criticalRecords': 1, 'operations.highPriorityRecords': 1 },
      });
      assertWellFormed(criticalAndHigh);

      // --- Floor: four criticals would reach 0; the extra high cannot ----
      // push it below, proving the max(0, ...) clamp.
      for (const label of ['FORMULA_FLOOR_1', 'FORMULA_FLOOR_2', 'FORMULA_FLOOR_3']) {
        await seedFailedWorkflowRun(label);
      }
      const floor = await operationsScore();
      expect(floor.score).toBe(0);
      expect(floor.score).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(floor.score)).toBe(true);
      expect(floor.evidence.filter((item) => item.priority === 'critical')).toHaveLength(4);
      expect(floor.inputs['operations.criticalRecords']).toBe(4);
      expect(floor.inputs['operations.highPriorityRecords']).toBe(1);
      assertWellFormed(floor);
    });

    it('explains permitted scores, returns safe 404s, and never leaks restricted evidence', async () => {
      const known = await get(full, `${URL}/explain/sales_health`);
      expect((known.body as ApiSuccessResponse<BusinessIntelligenceScore>).data).toMatchObject({
        id: 'sales_health',
        formulaVersion: '1.0',
      });
      const restricted = await get(finance, `${URL}/explain/sales_health`);
      expect((restricted.body as ApiSuccessResponse<BusinessIntelligenceScore>).data).toMatchObject(
        { score: null, status: 'unavailable' },
      );
      expect(JSON.stringify(restricted.body)).not.toContain(MARKERS.alpha.opportunity);
      const missing = await get(full, `${URL}/explain/not-a-score`, 404);
      expect(JSON.stringify(missing.body)).not.toContain('BusinessIntelligence');
    });
  });
});
