import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
}

export interface HealthCheckResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
  dependencies: {
    database: DependencyStatus;
    redis?: DependencyStatus;
  };
}

export interface ReadinessCheckResult {
  status: 'ready' | 'not_ready';
  timestamp: string;
  dependencies: {
    database: DependencyStatus;
    redis?: DependencyStatus;
  };
}

export interface LivenessCheckResult {
  status: 'alive';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redisEnabled: boolean;
  private readonly redisClient: Redis | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redisEnabled = this.configService.get<boolean>('redis.enabled', false);
    this.redisClient = this.redisEnabled
      ? new Redis(this.configService.get<string>('redis.url', 'redis://localhost:6379'), {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: () => null,
        })
      : null;
  }

  async check(): Promise<HealthCheckResult> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database,
        ...(redis ? { redis } : {}),
      },
    };
  }

  async readiness(): Promise<ReadinessCheckResult> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    return {
      // Redis is only load-bearing for readiness once REDIS_ENABLED=true —
      // this is the same requirement assertRedisRequirement() enforces at
      // boot, checked again continuously here so an operator's monitoring
      // catches Redis going down mid-flight, not just at startup.
      status: database.status === 'up' && (!redis || redis.status === 'up') ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        ...(redis ? { redis } : {}),
      },
    };
  }

  liveness(): LivenessCheckResult {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  onModuleDestroy(): void {
    this.redisClient?.disconnect();
  }

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
      if (this.redisClient.status === 'end' || this.redisClient.status === 'wait') {
        await this.redisClient.connect();
      }
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
