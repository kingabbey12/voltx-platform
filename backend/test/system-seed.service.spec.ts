import { SystemSeedService } from '../src/database/seed/system-seed.service';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '../src/database/seed/rbac.seed';
import * as rbacSeed from '../src/database/seed/rbac.seed';

/**
 * SystemSeedService is the shared, retrying verify-and-repair used by both
 * the boot guard and register()'s lazy self-heal. The behaviours that
 * matter for the production incident: it seeds when data is missing, it
 * survives a transient failure via retry, and it gives up loudly (throws)
 * rather than silently after exhausting retries.
 */
describe('SystemSeedService', () => {
  let roleCount: number;
  let permissionCount: number;
  let system: { role: { count: jest.Mock }; permission: { count: jest.Mock } };
  let prisma: { system: typeof system };
  let seedRbacSpy: jest.SpyInstance;

  function build(): SystemSeedService {
    return new SystemSeedService(prisma as never);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    roleCount = ROLE_DEFINITIONS.length;
    permissionCount = PERMISSION_DEFINITIONS.length;
    system = {
      role: { count: jest.fn(() => Promise.resolve(roleCount)) },
      permission: { count: jest.fn(() => Promise.resolve(permissionCount)) },
    };
    prisma = { system };
    seedRbacSpy = jest.spyOn(rbacSeed, 'seedRbac').mockImplementation(() => {
      roleCount = ROLE_DEFINITIONS.length;
      permissionCount = PERMISSION_DEFINITIONS.length;
      return Promise.resolve();
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not seed when RBAC is already complete', async () => {
    await build().ensureRbac();
    expect(seedRbacSpy).not.toHaveBeenCalled();
  });

  it('seeds RBAC when the owner role/permissions are missing', async () => {
    roleCount = 0;
    permissionCount = 0;

    await build().ensureRbac();

    expect(seedRbacSpy).toHaveBeenCalledWith(system);
  });

  it('retries a transient failure and then succeeds', async () => {
    roleCount = 0;
    permissionCount = 0;
    seedRbacSpy
      .mockRejectedValueOnce(new Error('prepared statement s0 already exists'))
      .mockImplementationOnce(() => {
        roleCount = ROLE_DEFINITIONS.length;
        permissionCount = PERMISSION_DEFINITIONS.length;
        return Promise.resolve();
      });

    const promise = build().ensureRbac();
    // advance through the backoff delay(s)
    await jest.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toBeUndefined();

    expect(seedRbacSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries (so callers can surface it)', async () => {
    roleCount = 0;
    permissionCount = 0;
    seedRbacSpy.mockRejectedValue(new Error('db down'));

    const promise = build().ensureRbac();
    const assertion = expect(promise).rejects.toThrow(/could not be ensured/);
    await jest.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});
