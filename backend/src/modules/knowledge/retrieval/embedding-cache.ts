import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, vector: number[], ttlMs: number): Promise<void>;
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

  get(key: string): Promise<number[] | null> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.vector);
    }
    return Promise.resolve(null);
  }

  set(key: string, vector: number[], ttlMs: number): Promise<void> {
    this.store.set(key, { vector, expiresAt: Date.now() + ttlMs });
    return Promise.resolve();
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
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Redis embedding cache write failed; continuing without caching it',
      );
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
    return configService.get<boolean>('redis.enabled', false)
      ? new RedisEmbeddingCache(configService)
      : new InMemoryEmbeddingCache();
  },
  inject: [ConfigService],
};
