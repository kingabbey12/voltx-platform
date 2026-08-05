import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const mockRedisConstructor = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: mockRedisConstructor,
}));

import {
  RedisConnectionService,
  redactRedisCredentials,
  redisReconnectDelay,
} from '../src/common/redis/redis-connection.service';
import { RedisClientModule } from '../src/common/redis/redis-client.module';
import {
  EXPECTED_IDLE_REDIS_CONNECTIONS,
  REDIS_QUEUE_NAMES,
} from '../src/common/redis/redis-queue.constants';
import { createBullRootOptions } from '../src/common/redis/bull-queue.module';

@Module({ imports: [RedisClientModule] })
class DuplicateFeatureModuleA {}

@Module({ imports: [RedisClientModule] })
class DuplicateFeatureModuleB {}

describe('Redis connection architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('constructs one singleton client when duplicate modules import RedisClientModule', async () => {
    const client = {
      status: 'wait',
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };
    mockRedisConstructor.mockImplementation(() => client);
    const startupLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [RedisClientModule, DuplicateFeatureModuleA, DuplicateFeatureModuleB],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'redis.enabled') return true;
          if (key === 'redis.url') return 'rediss://user:top-secret@redis.example.test:6379';
          return fallback;
        }),
      })
      .compile();

    await moduleRef.init();
    expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
    expect(moduleRef.get(RedisConnectionService)).toBe(
      moduleRef.get(RedisConnectionService, { strict: false }),
    );
    expect(startupLog).toHaveBeenCalledWith({
      expectedRedisConnections: EXPECTED_IDLE_REDIS_CONNECTIONS,
    });

    await moduleRef.close();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    startupLog.mockRestore();
  });

  it('passes the exact singleton client to the one BullMQ root', () => {
    const client = { status: 'ready' };
    const options = createBullRootOptions({ requireClient: () => client } as never);

    expect(options.connection).toBe(client);
  });

  it('has a unique queue set and an idle budget below the production limit', () => {
    expect(new Set(REDIS_QUEUE_NAMES).size).toBe(REDIS_QUEUE_NAMES.length);
    expect(REDIS_QUEUE_NAMES).toHaveLength(7);
    expect(EXPECTED_IDLE_REDIS_CONNECTIONS).toBe(8);
    expect(EXPECTED_IDLE_REDIS_CONNECTIONS).toBeLessThan(25);
  });

  it('bounds reconnect backoff and adds jitter', () => {
    expect(redisReconnectDelay(1, () => 0)).toBe(250);
    expect(redisReconnectDelay(1, () => 1)).toBe(500);
    expect(redisReconnectDelay(100, () => 1)).toBe(5_000);
    expect(redisReconnectDelay(100, () => 1)).toBeLessThanOrEqual(5_000);
  });

  it('redacts URL and raw configured credentials from Redis errors', () => {
    const redisUrl = 'rediss://service-user:top-secret@redis.example.test:6379';
    const message = redactRedisCredentials(
      'AUTH top-secret failed at rediss://service-user:top-secret@redis.example.test:6379',
      redisUrl,
    );

    expect(message).not.toContain('service-user');
    expect(message).not.toContain('top-secret');
    expect(message).toContain('[REDACTED]');
  });

  it('keeps the source module graph to one Bull root and one queue registration', () => {
    const sourceFiles = listTypeScriptFiles(join(process.cwd(), 'src'));
    const sources = sourceFiles.map((file) => ({ file, content: readFileSync(file, 'utf8') }));
    const bullRoots = sources.flatMap(({ file, content }) =>
      [...content.matchAll(/BullModule\.forRoot(?:Async)?\(/gu)].map(() =>
        relative(process.cwd(), file),
      ),
    );
    const queueRegistrations = sources.flatMap(({ file, content }) =>
      [...content.matchAll(/BullModule\.registerQueue\(/gu)].map(() =>
        relative(process.cwd(), file),
      ),
    );
    const queueEvents = sources.flatMap(({ file, content }) =>
      [...content.matchAll(/new QueueEvents\(/gu)].map(() => relative(process.cwd(), file)),
    );
    const redisConstructors = sources.flatMap(({ file, content }) =>
      [...content.matchAll(/new Redis\(/gu)].map(() => relative(process.cwd(), file)),
    );
    const processors = sources.reduce(
      (count, { content }) => count + [...content.matchAll(/@Processor\(/gu)].length,
      0,
    );

    expect(bullRoots).toEqual(['src/common/redis/bull-queue.module.ts']);
    expect(queueRegistrations).toEqual(['src/common/redis/bull-queue.module.ts']);
    expect(queueEvents).toEqual([]);
    expect(redisConstructors.sort()).toEqual([
      'src/bootstrap/redis-requirement.check.ts',
      'src/common/redis/redis-connection.service.ts',
    ]);
    expect(processors).toBe(REDIS_QUEUE_NAMES.length);
  });
});

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}
