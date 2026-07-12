import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { HealthCheckResult, HealthService } from '../../health/health.service';
import { MetricsService } from '../../metrics/metrics.service';

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QueueBacklogEntry {
  queue: string;
  depth: Record<string, number>;
  recentFailureCount: number;
}

export interface CommsDeliveryHealth {
  totalMessages: number;
  failedMessages: number;
  failureRate: number;
}

export interface PlatformSystemHealthResult {
  checkedAt: string;
  dependencies: HealthCheckResult['dependencies'];
  queues: QueueBacklogEntry[];
  commsDelivery: CommsDeliveryHealth;
}

/**
 * Read-only aggregation over existing observability surfaces
 * (HealthService, MetricsService's BullMQ queue depths,
 * BackgroundJobFailure, CommsMessage delivery status) — the Platform
 * Console's "system health" view, not a new monitoring stack. No new
 * data is collected here; this only reads and reshapes what already
 * exists.
 */
@Injectable()
export class PlatformSystemHealthService {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  async getSystemHealth(): Promise<PlatformSystemHealthResult> {
    const since = new Date(Date.now() - RECENT_WINDOW_MS);

    const [health, queueDepths, failureCounts, commsDelivery] = await Promise.all([
      this.healthService.check(),
      this.metricsService.getQueueDepths(),
      this.prisma.system.backgroundJobFailure.groupBy({
        by: ['queueName'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.getCommsDeliveryHealth(since),
    ]);

    const failuresByQueue = new Map(
      failureCounts.map((entry) => [entry.queueName, entry._count._all]),
    );
    const queues: QueueBacklogEntry[] = Object.entries(queueDepths).map(([queue, depth]) => ({
      queue,
      depth,
      recentFailureCount: failuresByQueue.get(queue) ?? 0,
    }));

    return {
      checkedAt: new Date().toISOString(),
      dependencies: health.dependencies,
      queues,
      commsDelivery,
    };
  }

  private async getCommsDeliveryHealth(since: Date): Promise<CommsDeliveryHealth> {
    const [totalMessages, failedMessages] = await Promise.all([
      this.prisma.system.commsMessage.count({ where: { createdAt: { gte: since } } }),
      this.prisma.system.commsMessage.count({
        where: { createdAt: { gte: since }, status: 'FAILED' },
      }),
    ]);

    return {
      totalMessages,
      failedMessages,
      failureRate: totalMessages === 0 ? 0 : failedMessages / totalMessages,
    };
  }
}
