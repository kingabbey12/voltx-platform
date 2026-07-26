import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

/**
 * Cross-replica mutual exclusion for background schedulers.
 *
 * Every `@Interval`/`CronJob` in this codebase is registered per process, so
 * on a horizontally scaled deployment each replica fires its own copy of
 * every sweep. The work those sweeps do is *not* idempotent — they send
 * customer-facing messages, write SubscriptionChange history, and start
 * workflow runs with side-effecting API/webhook steps. Running them N times
 * corrupts data in ways a rollback cannot undo, so every scheduled entry
 * point must be wrapped in one of the two primitives below.
 *
 * FAILURE POLICY — this deliberately fails *closed*, unlike CacheService,
 * which fails soft. If the lock cannot be acquired for any reason (Redis
 * down, network partition, timeout) the task does **not** run. Skipping one
 * tick is self-healing: the next tick picks the work up. Running a
 * non-idempotent sweep twice is not. Do not "fix" a quiet scheduler by
 * making acquisition failures fall through to execution.
 */
export interface DistributedLockService {
  /**
   * Runs `task` only if this replica holds `key`, then releases it. The lock
   * is auto-extended while `task` runs, so a slow sweep never lets a second
   * replica start a concurrent copy. Use for recurring `@Interval` sweeps,
   * where the goal is "never two at once" and the next interval retries.
   *
   * @returns true if this replica ran the task, false if another replica held the lock.
   */
  runExclusive(key: string, ttlMs: number, task: () => Promise<void>): Promise<boolean>;

  /**
   * Runs `task` only if this replica is the first to claim `key` within
   * `windowMs`, and holds the claim for the full window regardless of how
   * long `task` takes. Use for cron ticks, where every replica fires at
   * nominally the same instant and the goal is "exactly one replica per
   * tick" — holding past completion absorbs clock skew between replicas
   * that `runExclusive` would let through.
   *
   * @returns true if this replica ran the task, false if the window was already claimed.
   */
  runOncePerWindow(key: string, windowMs: number, task: () => Promise<void>): Promise<boolean>;
}

export const DISTRIBUTED_LOCK_SERVICE = Symbol('DISTRIBUTED_LOCK_SERVICE');

/** Releases the lock only if this replica still owns it — a lock that already
 *  expired under a long task must not be deleted out from under its new owner. */
const RELEASE_IF_OWNER = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/** Same ownership check for the auto-extend heartbeat. */
const EXTEND_IF_OWNER = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
  end
  return 0
`;

@Injectable()
export class RedisDistributedLockService implements DistributedLockService, OnModuleDestroy {
  private readonly logger = new Logger(RedisDistributedLockService.name);
  private readonly client: Redis;
  private readonly keyPrefix = 'voltx:lock:';

  constructor(configService: ConfigService) {
    const url = configService.get<string>('redis.url', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.on('error', (error) => {
      this.logger.warn(
        { err: error },
        'Redis connection error; scheduled sweeps will be skipped until it recovers',
      );
    });
  }

  async runExclusive(key: string, ttlMs: number, task: () => Promise<void>): Promise<boolean> {
    const token = await this.acquire(key, ttlMs);
    if (!token) {
      return false;
    }

    // Extend well before expiry so a task that outlives ttlMs keeps its lock
    // instead of letting a second replica start a concurrent copy.
    const heartbeat = setInterval(
      () => {
        void this.extend(key, token, ttlMs);
      },
      Math.max(1_000, Math.floor(ttlMs / 3)),
    );

    try {
      await task();
      return true;
    } finally {
      clearInterval(heartbeat);
      await this.release(key, token);
    }
  }

  async runOncePerWindow(
    key: string,
    windowMs: number,
    task: () => Promise<void>,
  ): Promise<boolean> {
    const token = await this.acquire(key, windowMs);
    if (!token) {
      return false;
    }
    // Intentionally never released: the claim must outlive the task so a
    // replica arriving late in the window still sees the tick as taken.
    await task();
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  private async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    try {
      await this.ensureConnected();
      const result = await this.client.set(
        this.keyPrefix + key,
        token,
        'PX',
        Math.max(1, ttlMs),
        'NX',
      );
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Could not acquire scheduler lock; skipping this run rather than risking a duplicate',
      );
      return null;
    }
  }

  private async extend(key: string, token: string, ttlMs: number): Promise<void> {
    try {
      await this.client.eval(EXTEND_IF_OWNER, 1, this.keyPrefix + key, token, Math.max(1, ttlMs));
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Could not extend scheduler lock');
    }
  }

  private async release(key: string, token: string): Promise<void> {
    try {
      await this.client.eval(RELEASE_IF_OWNER, 1, this.keyPrefix + key, token);
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Could not release scheduler lock; it will expire on its own TTL',
      );
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }
}

/**
 * Correct for a single instance, exactly like InMemoryCacheService — kept as
 * the fallback so local dev and tests need no Redis. A deployment that scales
 * past one replica MUST set REDIS_ENABLED=true; see docs/architecture.md.
 */
@Injectable()
export class InProcessDistributedLockService implements DistributedLockService {
  private readonly held = new Map<string, number>();

  async runExclusive(key: string, ttlMs: number, task: () => Promise<void>): Promise<boolean> {
    if (!this.claim(key, ttlMs)) {
      return false;
    }
    try {
      await task();
      return true;
    } finally {
      this.held.delete(key);
    }
  }

  async runOncePerWindow(
    key: string,
    windowMs: number,
    task: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.claim(key, windowMs)) {
      return false;
    }
    await task();
    return true;
  }

  private claim(key: string, ttlMs: number): boolean {
    const now = Date.now();
    for (const [heldKey, expiresAt] of this.held) {
      if (expiresAt <= now) {
        this.held.delete(heldKey);
      }
    }
    if (this.held.has(key)) {
      return false;
    }
    this.held.set(key, now + ttlMs);
    return true;
  }
}

export const distributedLockServiceProvider = {
  provide: DISTRIBUTED_LOCK_SERVICE,
  useFactory: (configService: ConfigService): DistributedLockService => {
    return configService.get<boolean>('redis.enabled', false)
      ? new RedisDistributedLockService(configService)
      : new InProcessDistributedLockService();
  },
  inject: [ConfigService],
};

/**
 * Key for a single cron tick, shared by every replica that fires it.
 *
 * `CronJob.lastDate()` reports when the tick actually ran, which drifts by a
 * few milliseconds per replica, so it is rounded to the nearest second — the
 * finest granularity the `cron` package schedules at. Two replicas firing the
 * same tick round to the same second; consecutive ticks are at least a second
 * apart and so never collide.
 */
export function cronTickKey(scope: string, firedAt: Date | null | undefined): string {
  const tickSecond = Math.round((firedAt?.getTime() ?? Date.now()) / 1000);
  return `${scope}:tick:${tickSecond}`;
}
