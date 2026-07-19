import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, vector: number[], ttlMs: number): Promise<void>;
  invalidateAll(): Promise<void>;
  getMetrics(): Promise<{
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
  }>;
}

interface CachedEmbedding {
  vector: number[];
  expiresAt: number;
}

/**
 * Default cache: correct for a single instance, but each horizontally
 * scaled replica would embed the same query independently on a cold
 * cache. Kept as the fallback when Redis isn't configured so local dev
 * and tests need no extra infra.
 */
@Injectable()
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private readonly store = new Map<string, CachedEmbedding>();
  private hits = 0;
  private misses = 0;
  private writes = 0;
  private invalidations = 0;

  get(key: string): Promise<number[] | null> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.hits += 1;
      return Promise.resolve(cached.vector);
    }
    this.misses += 1;
    return Promise.resolve(null);
  }

  set(key: string, vector: number[], ttlMs: number): Promise<void> {
    this.store.set(key, { vector, expiresAt: Date.now() + ttlMs });
    this.writes += 1;
    return Promise.resolve();
  }

  invalidateAll(): Promise<void> {
    this.store.clear();
    this.invalidations += 1;
    return Promise.resolve();
  }

  getMetrics(): Promise<{ hits: number; misses: number; writes: number; invalidations: number }> {
    return Promise.resolve({
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      invalidations: this.invalidations,
    });
  }
}

/**
 * Shares the embedding cache across every replica behind the load
 * balancer — the same query embedded on instance A is a cache hit on
 * instance B. Enabled only via REDIS_ENABLED so single-instance/dev/test
 * setups keep using the in-memory cache with zero extra infra.
 */
@Injectable()
export class RedisEmbeddingCache implements EmbeddingCache, OnModuleDestroy {
  private readonly logger = new Logger(RedisEmbeddingCache.name);
  private readonly client: Redis;
  private readonly keyPrefix = 'voltx:knowledge:embedding:';
  private readonly metricPrefix = 'voltx:knowledge:embedding:metrics:';

  constructor(configService: ConfigService) {
    const url = configService.get<string>('redis.url', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.on('error', (error) => {
      this.logger.warn(
        { err: error },
        'Redis connection error; embedding cache reads/writes will fail soft',
      );
    });
  }

  async get(key: string): Promise<number[] | null> {
    try {
      await this.ensureConnected();
      const raw = await this.client.get(this.keyPrefix + key);
      await this.client.incr(this.metricPrefix + (raw ? 'hits' : 'misses'));
      return raw ? (JSON.parse(raw) as number[]) : null;
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis embedding cache read failed; treating as a miss');
      return null;
    }
  }

  async set(key: string, vector: number[], ttlMs: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.client.set(this.keyPrefix + key, JSON.stringify(vector), 'PX', Math.max(1, ttlMs));
      await this.client.incr(this.metricPrefix + 'writes');
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Redis embedding cache write failed; continuing without caching it',
      );
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      await this.ensureConnected();
      const keys = await this.client.keys(this.keyPrefix + '*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      await this.client.incr(this.metricPrefix + 'invalidations');
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis embedding cache invalidation failed');
    }
  }

  async getMetrics(): Promise<{
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
  }> {
    try {
      await this.ensureConnected();
      const [hits, misses, writes, invalidations] = await Promise.all([
        this.client.get(this.metricPrefix + 'hits'),
        this.client.get(this.metricPrefix + 'misses'),
        this.client.get(this.metricPrefix + 'writes'),
        this.client.get(this.metricPrefix + 'invalidations'),
      ]);
      return {
        hits: Number.parseInt(hits ?? '0', 10),
        misses: Number.parseInt(misses ?? '0', 10),
        writes: Number.parseInt(writes ?? '0', 10),
        invalidations: Number.parseInt(invalidations ?? '0', 10),
      };
    } catch {
      return { hits: 0, misses: 0, writes: 0, invalidations: 0 };
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

export const EMBEDDING_CACHE = Symbol('EMBEDDING_CACHE');

export const embeddingCacheProvider = {
  provide: EMBEDDING_CACHE,
  useFactory: (configService: ConfigService): EmbeddingCache => {
    const redisEnabled = configService.get<boolean>('redis.enabled', false);
    const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
    if (nodeEnv === 'production' && !redisEnabled) {
      throw new Error('REDIS_ENABLED must be true in production for distributed embedding cache');
    }
    return redisEnabled ? new RedisEmbeddingCache(configService) : new InMemoryEmbeddingCache();
  },
  inject: [ConfigService],
};
