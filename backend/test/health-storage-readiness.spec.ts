import { RedisConnectionService } from '../src/common/redis/redis-connection.service';
import { PrismaService } from '../src/database/prisma.service';
import { HealthService } from '../src/modules/health/health.service';
import { StorageProvider } from '../src/modules/attachments/storage/storage-provider.interface';

/**
 * Object storage is reported continuously and treated as **degradable**
 * (Option B of the storage-readiness decision).
 *
 * The behaviour these tests pin down exists because of a real incident
 * shape: storage was verified only at boot, so a container whose
 * credentials were revoked after startup kept reporting `ready` for days.
 * Health checks that cannot observe a dependency are worse than none —
 * they actively assert something false.
 *
 * The counterpart risk is over-correction: making storage essential would
 * let one storage outage pull every healthy replica out of rotation for a
 * capability (attachments) the rest of the platform does not depend on.
 * Hence `degraded` rather than `not_ready`.
 */
describe('Health readiness — object storage', () => {
  function buildService(overrides: {
    storage?: Partial<StorageProvider>;
    databaseUp?: boolean;
    redisEnabled?: boolean;
  }) {
    const prisma = {
      system: {
        $queryRaw: jest
          .fn()
          .mockImplementation(() =>
            overrides.databaseUp === false
              ? Promise.reject(new Error('database down'))
              : Promise.resolve([{ 1: 1 }]),
          ),
      },
    } as unknown as PrismaService;

    const redisEnabled = overrides.redisEnabled ?? false;
    const redisClient = { status: 'ready', ping: jest.fn().mockResolvedValue('PONG') };
    const redisConnections = {
      isEnabled: jest.fn(() => redisEnabled),
      getClient: jest.fn(() => (redisEnabled ? redisClient : null)),
      ensureConnected: jest.fn().mockResolvedValue(redisClient),
    } as unknown as RedisConnectionService;

    const storage = {
      name: 's3' as const,
      checkHealth: jest.fn().mockResolvedValue(undefined),
      ...overrides.storage,
    } as unknown as StorageProvider;

    return { service: new HealthService(prisma, redisConnections, storage), storage };
  }

  it('reports ready with storage up', async () => {
    const { service } = buildService({});
    const result = await service.readiness();

    expect(result.status).toBe('ready');
    expect(result.dependencies.storage.status).toBe('up');
    expect(result.dependencies.storage.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded — not not_ready — when storage is unreachable', async () => {
    const { service } = buildService({
      storage: { checkHealth: jest.fn().mockRejectedValue(new Error('401 Unauthorized')) },
    });
    const result = await service.readiness();

    // The distinction is the whole point: the platform is still serving.
    expect(result.status).toBe('degraded');
    expect(result.status).not.toBe('not_ready');
    expect(result.dependencies.storage.status).toBe('down');
  });

  it('surfaces the failure cause rather than hiding it', async () => {
    const { service } = buildService({
      storage: { checkHealth: jest.fn().mockRejectedValue(new Error('401 Unauthorized')) },
    });
    const result = await service.readiness();

    expect(result.dependencies.storage.error).toContain('401');
  });

  it('never throws when the storage probe rejects', async () => {
    const { service } = buildService({
      storage: { checkHealth: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    await expect(service.readiness()).resolves.toBeDefined();
  });

  it('treats a storage timeout as down without hanging readiness', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const { service } = buildService({
      storage: { checkHealth: jest.fn().mockRejectedValue(timeout) },
    });

    const startedAt = Date.now();
    const result = await service.readiness();

    expect(result.dependencies.storage.status).toBe('down');
    // The provider owns the timeout budget; readiness must not add its own wait.
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it('still reports not_ready when an essential dependency is down, even if storage is up', async () => {
    const { service } = buildService({ databaseUp: false });
    const result = await service.readiness();

    expect(result.status).toBe('not_ready');
    expect(result.dependencies.database.status).toBe('down');
    expect(result.dependencies.storage.status).toBe('up');
  });

  it('reports not_ready when both database and storage are down', async () => {
    const { service } = buildService({
      databaseUp: false,
      storage: { checkHealth: jest.fn().mockRejectedValue(new Error('down')) },
    });
    const result = await service.readiness();

    // A failing essential dependency outranks degradation.
    expect(result.status).toBe('not_ready');
  });

  it('probes storage on every call, not once at boot', async () => {
    const { service, storage } = buildService({});
    await service.readiness();
    await service.readiness();
    await service.readiness();

    expect(storage.checkHealth).toHaveBeenCalledTimes(3);
  });

  it('includes storage in the deep health check too', async () => {
    const { service } = buildService({});
    const result = await service.check();

    expect(result.dependencies.storage.status).toBe('up');
  });

  it('runs dependency probes concurrently so readiness stays fast', async () => {
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 120));
    const { service } = buildService({ storage: { checkHealth: jest.fn(slow) } });

    const startedAt = Date.now();
    await service.readiness();

    // Sequential probes would sum; concurrent ones take the slowest.
    expect(Date.now() - startedAt).toBeLessThan(400);
  });
});
