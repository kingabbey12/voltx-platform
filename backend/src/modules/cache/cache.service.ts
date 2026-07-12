import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ISO-8601 with a mandatory 'Z' or offset, matching what JSON.stringify(Date)
// always produces — used to revive Date fields (e.g. PlanEntity.createdAt,
// BrandThemeEntity.updatedAt) that would otherwise come back as plain
// strings after a Redis JSON round-trip, silently breaking any caller that
// expects a real Date (e.g. `.toISOString()`). InMemoryCacheService needs no
// such revival — it never serializes, so Date instances survive as-is.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? new Date(value) : value;
}

/**
 * Generic read-through cache with tag-based invalidation, applied to hot,
 * rarely-changing reads (v2.2 Platform Scale) — the billing plan catalog,
 * resolved feature flags, and brand themes. A "tag" is a group label (e.g.
 * `feature-flag:new-dashboard`, `brand-theme:<orgId>`) that lets a write
 * path invalidate every cache entry it could have staled without knowing
 * every individual cache key that was ever derived from it.
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number, tags?: string[]): Promise<void>;
  invalidateKey(key: string): Promise<void>;
  invalidateTag(tag: string): Promise<void>;
}

/**
 * Correct for a single instance — each horizontally scaled replica would
 * cache independently. Kept as the fallback when Redis isn't configured
 * so local dev and tests need no extra infra, exactly like
 * knowledge/retrieval/embedding-cache.ts's InMemoryEmbeddingCache.
 */
@Injectable()
export class InMemoryCacheService implements CacheService {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly tagIndex = new Map<string, Set<string>>();

  get<T>(key: string): Promise<T | null> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value as T);
    }
    return Promise.resolve(null);
  }

  set<T>(key: string, value: T, ttlMs: number, tags: string[] = []): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    for (const tag of tags) {
      const members = this.tagIndex.get(tag) ?? new Set<string>();
      members.add(key);
      this.tagIndex.set(tag, members);
    }
    return Promise.resolve();
  }

  invalidateKey(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  invalidateTag(tag: string): Promise<void> {
    const members = this.tagIndex.get(tag);
    if (members) {
      for (const key of members) {
        this.store.delete(key);
      }
      this.tagIndex.delete(tag);
    }
    return Promise.resolve();
  }
}

/**
 * Shares the cache across every replica behind the load balancer.
 * Enabled only via REDIS_ENABLED, matching every other Redis-backed
 * feature in this codebase (queues, embedding cache) — single-instance/
 * dev/test setups keep using InMemoryCacheService with zero extra infra.
 * Failures fail soft (treated as a cache miss / no-op invalidation)
 * rather than surfacing to the caller — a stale or absent cache entry
 * is never worse than the read path this wraps, which always falls back
 * to the database.
 */
@Injectable()
export class RedisCacheService implements CacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;
  private readonly keyPrefix = 'voltx:cache:';
  private readonly tagPrefix = 'voltx:cache:tag:';

  constructor(configService: ConfigService) {
    const url = configService.get<string>('redis.url', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.on('error', (error) => {
      this.logger.warn({ err: error }, 'Redis connection error; cache reads/writes will fail soft');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();
      const raw = await this.client.get(this.keyPrefix + key);
      return raw ? (JSON.parse(raw, reviveDates) as T) : null;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis cache read failed; treating as a miss');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number, tags: string[] = []): Promise<void> {
    try {
      await this.ensureConnected();
      const pipeline = this.client.pipeline();
      pipeline.set(this.keyPrefix + key, JSON.stringify(value), 'PX', Math.max(1, ttlMs));
      for (const tag of tags) {
        pipeline.sadd(this.tagPrefix + tag, key);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Redis cache write failed; continuing without caching it',
      );
    }
  }

  async invalidateKey(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.client.del(this.keyPrefix + key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis cache invalidation failed');
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    try {
      await this.ensureConnected();
      const members = await this.client.smembers(this.tagPrefix + tag);
      if (members.length > 0) {
        await this.client.del(...members.map((key) => this.keyPrefix + key));
      }
      await this.client.del(this.tagPrefix + tag);
    } catch (error) {
      this.logger.warn({ err: error, tag }, 'Redis cache tag invalidation failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }
}

export const CACHE_SERVICE = Symbol('CACHE_SERVICE');

export const cacheServiceProvider = {
  provide: CACHE_SERVICE,
  useFactory: (configService: ConfigService): CacheService => {
    return configService.get<boolean>('redis.enabled', false)
      ? new RedisCacheService(configService)
      : new InMemoryCacheService();
  },
  inject: [ConfigService],
};
