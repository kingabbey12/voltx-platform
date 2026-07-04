import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface HealthCheckResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
  dependencies: {
    database: {
      status: 'up' | 'down';
      latencyMs: number;
    };
  };
}

export interface ReadinessCheckResult {
  status: 'ready' | 'not_ready';
  timestamp: string;
  dependencies: {
    database: {
      status: 'up' | 'down';
      latencyMs: number;
    };
  };
}

export interface LivenessCheckResult {
  status: 'alive';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    const database = await this.checkDatabase();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database,
      },
    };
  }

  async readiness(): Promise<ReadinessCheckResult> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
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

  private async checkDatabase(): Promise<{ status: 'up' | 'down'; latencyMs: number }> {
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
}
