import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { MicrosoftTeamsConnector } from '../../integrations/connectors/teams/microsoft-teams.connector';
import { AuditService } from '../../audit/audit.service';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { CommsChannelCredentialRepository } from '../channel-connections/channel-credential.repository';
import { CommsCredentialValue } from '../channels/channel-provider.interface';

const RENEWAL_SWEEP_INTERVAL_MS = 15 * 60_000;
// Renew once within 10 minutes of expiry rather than waiting until the
// last possible moment — a missed renewal means silently losing every
// inbound Teams message until someone notices and re-subscribes.
const RENEWAL_WINDOW_MS = 10 * 60_000;

interface TeamsSubscriptionConfig {
  subscriptionId: string;
  teamId: string;
  channelId: string;
  expiresAt: string;
}

/**
 * Owns the Graph subscription lifecycle a Teams connection needs before
 * any inbound webhook will ever fire — there is no "subscribe to
 * everything" option, and subscriptions expire (max ~60 minutes for chat
 * messages) so they must be actively renewed, unlike Slack's Events API
 * subscription which is configured once in the Slack app and never
 * expires.
 */
@Injectable()
export class TeamsSubscriptionService {
  private readonly logger = new Logger(TeamsSubscriptionService.name);

  constructor(
    private readonly teamsConnector: MicrosoftTeamsConnector,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly channelCredentialRepository: CommsChannelCredentialRepository,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async subscribeToChannel(
    connectionId: string,
    teamId: string,
    channelId: string,
  ): Promise<TeamsSubscriptionConfig> {
    const connection = await this.channelConnectionService.getConnectionOrThrow(connectionId);
    if (connection.channel !== 'TEAMS') {
      throw new BadRequestException('This connection is not a Teams connection');
    }

    const credential = await this.channelConnectionService.getValidCredential(connection);
    const clientState = randomUUID();
    const webhookBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    const notificationUrl = `${webhookBaseUrl}/api/v1/communications/webhooks/teams`;

    const subscription = await this.teamsConnector.createSubscription(
      teamId,
      channelId,
      notificationUrl,
      clientState,
      { organizationId: connection.organizationId, connectionId: connection.id, credential },
    );

    await this.storeClientState(connection.id, credential, clientState);

    const subscriptionConfig: TeamsSubscriptionConfig = {
      subscriptionId: subscription.id,
      teamId,
      channelId,
      expiresAt: subscription.expirationDateTime,
    };
    await this.channelConnectionRepository.update(connection.id, {
      config: { ...connection.config, ...subscriptionConfig },
    });

    await this.auditService.record({
      action: 'communications.teams.subscribed',
      resource: 'comms_channel_connection',
      resourceId: connection.id,
      metadata: { teamId, channelId },
    });

    return subscriptionConfig;
  }

  /** Reads back the clientState generated at subscribe time, for the webhook controller to verify the signature against. */
  async getClientState(connectionId: string): Promise<string | undefined> {
    const record = await this.channelCredentialRepository.findByConnectionIdUnscoped(connectionId);
    if (!record) return undefined;
    const credential = this.encryptionService.decryptJson<CommsCredentialValue>(
      record.encryptedPayload,
    );
    return (credential.extra as { teamsClientState?: string } | undefined)?.teamsClientState;
  }

  @Interval(RENEWAL_SWEEP_INTERVAL_MS)
  async renewExpiringSubscriptions(): Promise<void> {
    const connections = await this.channelConnectionRepository.listTeamsWithSubscriptionUnscoped();

    for (const connection of connections) {
      const config = connection.config as Partial<TeamsSubscriptionConfig>;
      if (!config.subscriptionId || !config.expiresAt) continue;

      const expiresInMs = new Date(config.expiresAt).getTime() - Date.now();
      if (expiresInMs > RENEWAL_WINDOW_MS) continue;

      try {
        const credential = await this.channelConnectionService.getValidCredential(connection);
        const renewed = await this.teamsConnector.renewSubscription(config.subscriptionId, {
          organizationId: connection.organizationId,
          connectionId: connection.id,
          credential,
        });
        await this.channelConnectionRepository.update(connection.id, {
          config: { ...connection.config, expiresAt: renewed.expirationDateTime },
        });
      } catch (error) {
        this.logger.error(
          { err: error, connectionId: connection.id },
          'Failed to renew Teams subscription',
        );
      }
    }
  }

  private async storeClientState(
    connectionId: string,
    credential: CommsCredentialValue,
    clientState: string,
  ): Promise<void> {
    const nextCredential: CommsCredentialValue = {
      ...credential,
      extra: { ...credential.extra, teamsClientState: clientState },
    };
    await this.channelCredentialRepository.upsert({
      connectionId,
      encryptedPayload: this.encryptionService.encryptJson(
        nextCredential as unknown as Record<string, unknown>,
      ),
      expiresAt: credential.expiresAt ?? null,
    });
  }
}
