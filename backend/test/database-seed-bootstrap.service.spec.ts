import { DatabaseSeedBootstrapService } from '../src/database/seed/database-seed-bootstrap.service';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '../src/database/seed/rbac.seed';
import { PLAN_SEEDS } from '../src/database/seed/billing-plans.seed';
import { TEMPLATE_SEEDS } from '../src/database/seed/workflow-templates.seed';
import * as rbacSeed from '../src/database/seed/rbac.seed';
import * as billingSeed from '../src/database/seed/billing-plans.seed';
import * as templateSeed from '../src/database/seed/workflow-templates.seed';

/**
 * The core guarantee: if the `owner` role (or any RBAC/plan/template
 * baseline) is missing at boot, the service repairs it — so registration
 * can never again fail with P2025 on an un-seeded production database.
 */
describe('DatabaseSeedBootstrapService', () => {
  let roleCount: number;
  let permissionCount: number;
  let planCount: number;
  let templateCount: number;
  let system: {
    role: { count: jest.Mock };
    permission: { count: jest.Mock };
    plan: { count: jest.Mock };
    workflowTemplate: { count: jest.Mock };
  };
  let prisma: { system: typeof system };
  let seedRbacSpy: jest.SpyInstance;
  let seedBillingSpy: jest.SpyInstance;
  let seedTemplatesSpy: jest.SpyInstance;

  function configWith(seedOnBootstrap: boolean) {
    return {
      get: jest.fn((_key: string, defaultValue: unknown) =>
        _key === 'database.seedOnBootstrap' ? seedOnBootstrap : defaultValue,
      ),
    } as never;
  }

  function buildService(seedOnBootstrap = true): DatabaseSeedBootstrapService {
    return new DatabaseSeedBootstrapService(prisma as never, configWith(seedOnBootstrap));
  }

  beforeEach(() => {
    // Fully-seeded baseline by default.
    roleCount = ROLE_DEFINITIONS.length;
    permissionCount = PERMISSION_DEFINITIONS.length;
    planCount = PLAN_SEEDS.length;
    templateCount = TEMPLATE_SEEDS.length;

    system = {
      role: { count: jest.fn(() => Promise.resolve(roleCount)) },
      permission: { count: jest.fn(() => Promise.resolve(permissionCount)) },
      plan: { count: jest.fn(() => Promise.resolve(planCount)) },
      workflowTemplate: { count: jest.fn(() => Promise.resolve(templateCount)) },
    };
    prisma = { system };

    // Repairs "fill in" the missing data so the post-repair re-check passes.
    seedRbacSpy = jest.spyOn(rbacSeed, 'seedRbac').mockImplementation(() => {
      roleCount = ROLE_DEFINITIONS.length;
      permissionCount = PERMISSION_DEFINITIONS.length;
      return Promise.resolve();
    });
    seedBillingSpy = jest.spyOn(billingSeed, 'seedBillingPlans').mockImplementation(() => {
      planCount = PLAN_SEEDS.length;
      return Promise.resolve();
    });
    seedTemplatesSpy = jest.spyOn(templateSeed, 'seedWorkflowTemplates').mockImplementation(() => {
      templateCount = TEMPLATE_SEEDS.length;
      return Promise.resolve();
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing but cheap COUNT checks when everything is already seeded', async () => {
    await buildService().onApplicationBootstrap();

    expect(seedRbacSpy).not.toHaveBeenCalled();
    expect(seedBillingSpy).not.toHaveBeenCalled();
    expect(seedTemplatesSpy).not.toHaveBeenCalled();
  });

  it('auto-repairs RBAC when the owner role / permissions are missing (the P2025 incident)', async () => {
    roleCount = 0;
    permissionCount = 0;

    await buildService().onApplicationBootstrap();

    expect(seedRbacSpy).toHaveBeenCalledWith(system);
  });

  it('auto-repairs billing plans when missing (registration trial-plan dependency)', async () => {
    planCount = 0;

    await buildService().onApplicationBootstrap();

    expect(seedBillingSpy).toHaveBeenCalledWith(system);
  });

  it('auto-repairs workflow templates when missing', async () => {
    templateCount = 0;

    await buildService().onApplicationBootstrap();

    expect(seedTemplatesSpy).toHaveBeenCalledWith(system);
  });

  it('is a no-op when seedOnBootstrap is disabled (test/CI harness owns seeding)', async () => {
    roleCount = 0;
    planCount = 0;
    templateCount = 0;

    await buildService(false).onApplicationBootstrap();

    expect(system.role.count).not.toHaveBeenCalled();
    expect(seedRbacSpy).not.toHaveBeenCalled();
  });

  it('never throws out of boot when a repair fails — logs and continues', async () => {
    roleCount = 0;
    seedRbacSpy.mockRejectedValue(new Error('transient DB error'));

    await expect(buildService().onApplicationBootstrap()).resolves.toBeUndefined();
    // A failed RBAC repair must not prevent the later checks from running.
    expect(system.plan.count).toHaveBeenCalled();
  });
});
