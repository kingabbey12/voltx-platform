import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  DISTRIBUTED_LOCK_SERVICE,
  DistributedLockService,
} from '../../common/scheduling/distributed-lock.service';
import { AuthContextRepository } from '../auth/auth-context.repository';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { IntegrationConnectionRepository } from './integration-connection.repository';
import { IntegrationConnectionService } from './integration-connection.service';
import { IntegrationProviderRegistry } from './provider/integration-provider.registry';

const POLL_SWEEP_INTERVAL_MS = 5 * 60_000;
/** Auto-extended while a sweep runs, so a slow sweep still blocks a second replica. */
const POLL_SWEEP_LOCK_TTL_MS = 10 * 60_000;

/**
 * Background sweep for connectors that only support polling (no
 * real-time webhook push) — Gmail/Calendar/Drive/Outlook/OneDrive.
 * Complements the admin "Sync" endpoint (manual trigger) rather than
 * replacing it; both call the same IntegrationConnectionService.sync.
 * Each connection's sync runs in its own bootstrapped tenant context
 * (same pattern as WorkflowSchedulerService — there's no HTTP request to
 * inherit context from in a timer callback), and one connection's
 * failure never stops the sweep from continuing to the next.
 */
@Injectable()
export class IntegrationPollerService {
  private readonly logger = new Logger(IntegrationPollerService.name);

  constructor(
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationConnectionService: IntegrationConnectionService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
    @Inject(DISTRIBUTED_LOCK_SERVICE)
    private readonly distributedLock: DistributedLockService,
  ) {}

  /**
   * Every replica runs this timer, but polling a connection twice re-ingests
   * the same upstream items, so only the replica holding the lock sweeps.
   */
  @Interval(POLL_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    await this.distributedLock.runExclusive(
      'integration-poller:sweep',
      POLL_SWEEP_LOCK_TTL_MS,
      () => this.runSweep(),
    );
  }

  private async runSweep(): Promise<void> {
    const pollableProviders = this.integrationProviderRegistry
      .list()
      .filter((provider) => provider.supportsPolling)
      .map((provider) => provider.key);

    if (pollableProviders.length === 0) {
      return;
    }

    const connections =
      await this.integrationConnectionRepository.listConnectedByProvidersUnscoped(
        pollableProviders,
      );

    for (const connection of connections) {
      try {
        const membership = await this.authContextRepository.findActiveMembershipContext(
          connection.createdBy,
          connection.organizationId,
        );

        await this.tenantContextService.run(
          {
            organizationId: connection.organizationId,
            userId: connection.createdBy,
            membershipId: membership?.id ?? '',
            requestId: randomUUID(),
          },
          () => this.integrationConnectionService.sync(connection.id),
        );
      } catch (error) {
        this.logger.error(
          { err: error, connectionId: connection.id, provider: connection.provider },
          'Background poll sync failed',
        );
      }
    }
  }
}
