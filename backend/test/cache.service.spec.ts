import { ConfigService } from '@nestjs/config';

interface MockRedisClient {
  status: string;
  on: jest.Mock;
  connect: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  smembers: jest.Mock;
  pipeline: jest.Mock;
}

let mockClient: MockRedisClient;
let pipelineCalls: { set?: unknown[]; sadd: unknown[][] };

// Unit tests must not require a live Redis server (only pnpm test:e2e's
// Postgres dependency is a documented prerequisite) — RedisCacheService is
// verified below against a mocked ioredis client instead of a real
// connection. Declared before any import of cache.service.ts so its own
// `import Redis from 'ioredis'` resolves to this mock.
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockClient),
}));

import { InMemoryCacheService, RedisCacheService } from '../src/modules/cache/cache.service';

describe('InMemoryCacheService (v2.2 Platform Scale)', () => {
  let service: InMemoryCacheService;

  beforeEach(() => {
    service = new InMemoryCacheService();
  });

  it('returns null for a key that was never set', async () => {
    expect(await service.get('missing')).toBeNull();
  });

  it('returns the cached value before it expires', async () => {
    await service.set('key-1', { hello: 'world' }, 60_000);
    expect(await service.get('key-1')).toEqual({ hello: 'world' });
  });

  it('returns null once the TTL has elapsed', async () => {
    jest.useFakeTimers();
    try {
      await service.set('key-1', 'value', 10);
      jest.advanceTimersByTime(11);
      expect(await service.get('key-1')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidateKey removes exactly that key', async () => {
    await service.set('key-1', 'value-1', 60_000);
    await service.set('key-2', 'value-2', 60_000);

    await service.invalidateKey('key-1');

    expect(await service.get('key-1')).toBeNull();
    expect(await service.get('key-2')).toBe('value-2');
  });

  it('invalidateTag removes every key registered under that tag, and only those', async () => {
    await service.set('flag:a:org-1', 'a1', 60_000, ['flag:a']);
    await service.set('flag:a:org-2', 'a2', 60_000, ['flag:a']);
    await service.set('flag:b:org-1', 'b1', 60_000, ['flag:b']);

    await service.invalidateTag('flag:a');

    expect(await service.get('flag:a:org-1')).toBeNull();
    expect(await service.get('flag:a:org-2')).toBeNull();
    expect(await service.get('flag:b:org-1')).toBe('b1');
  });

  it('a key registered under multiple tags is removed when any one of them is invalidated', async () => {
    await service.set('theme:org-1', { color: 'blue' }, 60_000, ['brand-theme:org-1', 'org:org-1']);

    await service.invalidateTag('org:org-1');

    expect(await service.get('theme:org-1')).toBeNull();
  });
});

describe('RedisCacheService (v2.2 Platform Scale) — command usage, mocked ioredis', () => {
  beforeEach(() => {
    pipelineCalls = { sadd: [] };
    mockClient = {
      status: 'ready',
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      pipeline: jest.fn(() => {
        const pipeline: {
          set: (...args: unknown[]) => typeof pipeline;
          sadd: (...args: unknown[]) => typeof pipeline;
          exec: () => Promise<unknown[]>;
        } = {
          set: jest.fn((...args: unknown[]) => {
            pipelineCalls.set = args;
            return pipeline;
          }) as (...args: unknown[]) => typeof pipeline,
          sadd: jest.fn((...args: unknown[]) => {
            pipelineCalls.sadd.push(args);
            return pipeline;
          }) as (...args: unknown[]) => typeof pipeline,
          exec: jest.fn().mockResolvedValue([]),
        };
        return pipeline;
      }),
    };
  });

  function buildService(): RedisCacheService {
    const configService = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    return new RedisCacheService(configService);
  }

  it('revives ISO-8601 date strings back into Date instances on read', async () => {
    const service = buildService();
    mockClient.get.mockResolvedValue(
      JSON.stringify({ id: 'plan-1', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
    );

    const result = await service.get<{ id: string; createdAt: Date }>('billing:plan-catalog');

    expect(result?.createdAt).toBeInstanceOf(Date);
    expect(result?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('writes through a pipeline, registering the key under every given tag', async () => {
    const service = buildService();

    await service.set('feature-flag:resolve:x:org-1', { value: true }, 60_000, ['feature-flag:x']);

    expect(pipelineCalls.set?.[0]).toBe('voltx:cache:feature-flag:resolve:x:org-1');
    expect(pipelineCalls.sadd).toEqual([
      ['voltx:cache:tag:feature-flag:x', 'feature-flag:resolve:x:org-1'],
    ]);
  });

  it('invalidateTag deletes every member key plus the tag set itself', async () => {
    const service = buildService();
    mockClient.smembers.mockResolvedValue([
      'feature-flag:resolve:x:org-1',
      'feature-flag:resolve:x:org-2',
    ]);

    await service.invalidateTag('feature-flag:x');

    expect(mockClient.del).toHaveBeenNthCalledWith(
      1,
      'voltx:cache:feature-flag:resolve:x:org-1',
      'voltx:cache:feature-flag:resolve:x:org-2',
    );
    expect(mockClient.del).toHaveBeenNthCalledWith(2, 'voltx:cache:tag:feature-flag:x');
  });

  it('treats a read failure as a cache miss rather than throwing', async () => {
    const service = buildService();
    mockClient.get.mockRejectedValue(new Error('connection reset'));

    await expect(service.get('any-key')).resolves.toBeNull();
  });
});
