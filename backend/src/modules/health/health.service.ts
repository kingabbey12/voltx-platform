import { Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionService } from '../../common/redis/redis-connection.service';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../attachments/storage/storage-provider.interface';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
  /** Present only on failure, so operators see the cause without a log dive. */
  error?: string;
}

export interface HealthCheckResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
  dependencies: {
    database: DependencyStatus;
    redis?: DependencyStatus;
    storage: DependencyStatus;
  };
}

export interface ReadinessCheckResult {
  /**
   * `degraded` means the service is serving correctly but a non-essential
   * dependency is down — currently only object storage. It is deliberately
   * distinct from `not_ready`: attachments failing must not take the whole
   * platform out of rotation, but it must not be invisible either.
   */
  status: 'ready' | 'degraded' | 'not_ready';
  timestamp: string;
  dependencies: {
    database: DependencyStatus;
    redis?: DependencyStatus;
    storage: DependencyStatus;
  };
}

export interface LivenessCheckResult {
  status: 'alive';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  private readonly redisEnabled: boolean;
  private readonly redisClient: Redis | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisConnections: RedisConnectionService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    this.redisEnabled = redisConnections.isEnabled();
    this.redisClient = redisConnections.getClient();
  }

  async check(): Promise<HealthCheckResult> {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database,
        ...(redis ? { redis } : {}),
        storage,
      },
    };
  }

  async readiness(): Promise<ReadinessCheckResult> {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    // Redis is only load-bearing for readiness once REDIS_ENABLED=true —
    // this is the same requirement assertRedisRequirement() enforces at
    // boot, checked again continuously here so an operator's monitoring
    // catches Redis going down mid-flight, not just at startup.
    const essentialUp = database.status === 'up' && (!redis || redis.status === 'up');

    // Object storage is deliberately NOT essential. Attachments are one
    // capability; the executive stack, CRM, finance and workflows all keep
    // working without them. Reporting `not_ready` would let a storage
    // outage pull every healthy replica out of rotation. It is still
    // surfaced — and alerted on — so it can never again be silently
    // unhealthy the way a boot-only check allowed.
    return {
      status: !essentialUp ? 'not_ready' : storage.status === 'up' ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        ...(redis ? { redis } : {}),
        storage,
      },
    };
  }

  /** Never throws: an unreachable backend is a reported status, not an error. */
  private async checkStorage(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      await this.storageProvider.checkHealth();
      this.metricsService?.recordObjectStorageHealth(true);
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.metricsService?.recordObjectStorageHealth(false);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'storage unreachable',
      };
    }
  }

  liveness(): LivenessCheckResult {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** The shared Redis client is closed once by RedisConnectionService. */
  onModuleDestroy(): void {}

  private async checkDatabase(): Promise<DependencyStatus> {
    const startedAt = performance.now();

    try {
      await this.prisma.system.$queryRaw`SELECT 1`;

      return {
        status: 'up',
        latencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    const startedAt = performance.now();
    try {
      await this.redisConnections.ensureConnected();
      await this.redisClient.ping();
      return {
        status: 'up',
        latencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    }
  }
}
