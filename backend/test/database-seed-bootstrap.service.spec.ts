import { DatabaseSeedBootstrapService } from '../src/database/seed/database-seed-bootstrap.service';
import { SystemSeedService } from '../src/database/seed/system-seed.service';

describe('DatabaseSeedBootstrapService', () => {
  let systemSeedService: {
    ensureRbac: jest.Mock;
    ensureBillingPlans: jest.Mock;
    ensureWorkflowTemplates: jest.Mock;
  };

  function configWith(seedOnBootstrap: boolean) {
    return {
      get: jest.fn((key: string, defaultValue: unknown) =>
        key === 'database.seedOnBootstrap' ? seedOnBootstrap : defaultValue,
      ),
    } as never;
  }

  function build(seedOnBootstrap = true): DatabaseSeedBootstrapService {
    return new DatabaseSeedBootstrapService(
      systemSeedService as unknown as SystemSeedService,
      configWith(seedOnBootstrap),
    );
  }

  beforeEach(() => {
    systemSeedService = {
      ensureRbac: jest.fn().mockResolvedValue(undefined),
      ensureBillingPlans: jest.fn().mockResolvedValue(undefined),
      ensureWorkflowTemplates: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('ensures RBAC, plans, and templates on boot', async () => {
    await build().onApplicationBootstrap();

    expect(systemSeedService.ensureRbac).toHaveBeenCalled();
    expect(systemSeedService.ensureBillingPlans).toHaveBeenCalled();
    expect(systemSeedService.ensureWorkflowTemplates).toHaveBeenCalled();
  });

  it('is a no-op when seedOnBootstrap is disabled', async () => {
    await build(false).onApplicationBootstrap();

    expect(systemSeedService.ensureRbac).not.toHaveBeenCalled();
  });

  it('never throws out of boot when a seed step fails — and still runs the others', async () => {
    systemSeedService.ensureRbac.mockRejectedValue(new Error('cold db'));

    await expect(build().onApplicationBootstrap()).resolves.toBeUndefined();
    // RBAC failing must not skip plans/templates.
    expect(systemSeedService.ensureBillingPlans).toHaveBeenCalled();
    expect(systemSeedService.ensureWorkflowTemplates).toHaveBeenCalled();
  });
});
