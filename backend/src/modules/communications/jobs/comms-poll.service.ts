import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  DISTRIBUTED_LOCK_SERVICE,
  DistributedLockService,
} from '../../../common/scheduling/distributed-lock.service';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ConversationService } from '../conversation/conversation.service';
import { AiProcessQueueService } from './ai-process-queue.service';

const POLL_SWEEP_INTERVAL_MS = 2 * 60_000;
/** Auto-extended while a sweep runs, so a slow sweep still blocks a second replica. */
const POLL_SWEEP_LOCK_TTL_MS = 5 * 60_000;

/**
 * Background sweep for every polling-only channel (Gmail, Outlook — no
 * simple webhook without a separate push-notification setup for either).
 * Genuinely channel-agnostic: it iterates whichever registered providers
 * report supportsPolling, so a new polling channel needs no changes here.
 * Mirrors IntegrationPollerService's sweep exactly: each connection's
 * poll runs in its own bootstrapped tenant context (no HTTP request to
 * inherit context from in a timer callback), and one connection's failure
 * never stops the sweep from continuing to the next.
 */
@Injectable()
export class CommsPollService {
  private readonly logger = new Logger(CommsPollService.name);

  constructor(
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly conversationService: ConversationService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly aiProcessQueueService: AiProcessQueueService,
    @Inject(DISTRIBUTED_LOCK_SERVICE)
    private readonly distributedLock: DistributedLockService,
  ) {}

  /**
   * Every replica runs this timer. Polling a channel twice ingests each
   * inbound message twice, which queues a second AI reply — the customer
   * receives a duplicate — so only the lock holder sweeps.
   */
  @Interval(POLL_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    await this.distributedLock.runExclusive('comms-poller:sweep', POLL_SWEEP_LOCK_TTL_MS, () =>
      this.runSweep(),
    );
  }

  private async runSweep(): Promise<void> {
    const pollableChannels = this.channelProviderRegistry
      .list()
      .filter((provider) => provider.supportsPolling)
      .map((provider) => provider.channel);

    if (pollableChannels.length === 0) return;

    const connections =
      await this.channelConnectionRepository.listConnectedByChannelsUnscoped(pollableChannels);

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
          () => this.pollOne(connection),
        );
      } catch (error) {
        this.logger.error(
          { err: error, connectionId: connection.id, channel: connection.channel },
          'Comms poll sweep failed for connection',
        );
      }
    }
  }

  private async pollOne(
    connection: Awaited<ReturnType<ChannelConnectionRepository['findByIdUnscoped']>>,
  ): Promise<void> {
    if (!connection) return;
    const provider = this.channelProviderRegistry.get(connection.channel);
    if (!provider.poll) return;

    const credential = await this.channelConnectionService.getValidCredential(connection);
    const cursor = (connection.config as { pollCursor?: string }).pollCursor;
    const result = await provider.poll(
      { organizationId: connection.organizationId, connectionId: connection.id, credential },
      cursor,
    );

    for (const message of result.messages) {
      const ingested = await this.conversationService.ingestInboundMessage(
        connection.organizationId,
        connection.id,
        connection.channel,
        message,
      );
      if (ingested) {
        this.aiProcessQueueService.enqueueSummarize(
          ingested.conversationId,
          connection.organizationId,
        );
      }
    }

    await this.channelConnectionRepository.update(connection.id, {
      lastSyncAt: new Date(),
      config: { ...connection.config, pollCursor: result.nextCursor ?? cursor },
    });
  }
}
