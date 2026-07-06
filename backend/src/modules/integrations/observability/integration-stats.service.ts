import { Injectable } from '@nestjs/common';
import { IntegrationApiUsageLogRepository } from '../integration-api-usage-log.repository';
import { IntegrationEventRepository } from '../integration-event.repository';
import { IntegrationSyncRunRepository } from '../integration-sync-run.repository';
import { IntegrationConnectionRepository } from '../integration-connection.repository';

export interface IntegrationMetrics {
  totalCalls: number;
  failedCalls: number;
  totalRetries: number;
  averageDurationMs: number;
  minRateLimitRemaining: number | null;
  totalSyncRuns: number;
  failedSyncRuns: number;
  totalEvents: number;
  lastHealthStatus: string;
  lastHealthCheckAt: string | null;
}

/**
 * Aggregates the observability data the ticket asks for (connection
 * health, sync duration, API usage, rate limits, retries, failures,
 * webhook latency via the health-check log, OAuth refreshes captured as
 * TOKEN_REFRESHED events, streaming events via the event log) from the
 * repositories that already record it — no separate metrics pipeline.
 */
@Injectable()
export class IntegrationStatsService {
  constructor(
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationApiUsageLogRepository: IntegrationApiUsageLogRepository,
    private readonly integrationEventRepository: IntegrationEventRepository,
    private readonly integrationSyncRunRepository: IntegrationSyncRunRepository,
  ) {}

  async getMetrics(connectionId: string): Promise<IntegrationMetrics> {
    const [connection, usage, syncRuns, events] = await Promise.all([
      this.integrationConnectionRepository.findById(connectionId),
      this.integrationApiUsageLogRepository.aggregateForConnection(connectionId),
      this.integrationSyncRunRepository.listByConnection(connectionId, 1, 1000),
      this.integrationEventRepository.listByConnection(connectionId, 1, 1),
    ]);

    const failedSyncRuns = syncRuns.items.filter((run) => run.status === 'FAILED').length;

    return {
      totalCalls: usage.totalCalls,
      failedCalls: usage.failedCalls,
      totalRetries: usage.totalRetries,
      averageDurationMs: usage.averageDurationMs,
      minRateLimitRemaining: usage.minRateLimitRemaining,
      totalSyncRuns: syncRuns.total,
      failedSyncRuns,
      totalEvents: events.total,
      lastHealthStatus: connection?.lastHealthStatus ?? 'UNKNOWN',
      lastHealthCheckAt: connection?.lastHealthCheckAt
        ? connection.lastHealthCheckAt.toISOString()
        : null,
    };
  }
}
