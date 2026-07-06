import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationConnectionRepository } from '../integration-connection.repository';
import { IntegrationWebhookEndpointRepository } from '../integration-webhook-endpoint.repository';
import { IntegrationEventRepository } from '../integration-event.repository';
import { IntegrationEventBusService } from '../events/integration-event-bus.service';
import { IntegrationKnowledgeContributorService } from '../knowledge/integration-knowledge-contributor.service';
import { IntegrationProviderRegistry } from '../provider/integration-provider.registry';
import { EncryptionService } from '../security/encryption.service';

/**
 * The public inbound webhook endpoint — no bearer token, since the
 * calling party is an external provider, not a Voltx user. Identity and
 * tenant scoping instead come entirely from the unguessable `token` in
 * the URL (which resolves to exactly one connection/organization), and
 * signature verification (provider-specific, via IntegrationProvider)
 * is what proves the request actually came from that provider.
 * Idempotency is enforced by IntegrationEventRepository's DB-level unique
 * constraint on (connectionId, externalId) — a provider's retried
 * delivery of the same event is a no-op here, not a duplicate ingestion.
 */
@Injectable()
export class IntegrationWebhookReceiverService {
  private readonly logger = new Logger(IntegrationWebhookReceiverService.name);

  constructor(
    private readonly integrationWebhookEndpointRepository: IntegrationWebhookEndpointRepository,
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationEventRepository: IntegrationEventRepository,
    private readonly integrationEventBusService: IntegrationEventBusService,
    private readonly integrationKnowledgeContributorService: IntegrationKnowledgeContributorService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly encryptionService: EncryptionService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async receive(
    token: string,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<{ received: boolean; eventsProcessed: number }> {
    const endpoint = await this.integrationWebhookEndpointRepository.findByTokenUnscoped(token);
    if (!endpoint || !endpoint.enabled) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const connection = await this.integrationConnectionRepository.findByIdUnscoped(
      endpoint.connectionId,
    );
    if (!connection) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.verifyWebhookSignature || !provider.parseWebhookPayload) {
      throw new BadRequestException(`Provider "${connection.provider}" does not support webhooks`);
    }

    const secret = this.encryptionService.decrypt(endpoint.encryptedSecret);
    if (!provider.verifyWebhookSignature(headers, rawBody, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const events = provider.parseWebhookPayload(headers, rawBody);
    const membership = await this.authContextRepository.findActiveMembershipContext(
      connection.createdBy,
      connection.organizationId,
    );

    let eventsProcessed = 0;
    await this.tenantContextService.run(
      {
        organizationId: connection.organizationId,
        userId: connection.createdBy,
        membershipId: membership?.id ?? '',
        requestId: randomUUID(),
      },
      async () => {
        for (const event of events) {
          const { event: stored, isNew } = await this.integrationEventRepository.createIfNew({
            organizationId: connection.organizationId,
            connectionId: connection.id,
            type: event.type,
            externalId: event.externalId,
            payload: event.payload,
          });

          if (isNew) {
            this.integrationEventBusService.publish({
              organizationId: connection.organizationId,
              connectionId: connection.id,
              type: stored.type,
              payload: stored.payload,
              occurredAt: stored.createdAt.toISOString(),
            });
            await this.integrationKnowledgeContributorService.contribute(connection, event);
          }
          eventsProcessed += 1;
        }
      },
    );

    await this.integrationWebhookEndpointRepository.markReceived(endpoint.id);
    this.logger.log(
      { connectionId: connection.id, eventsProcessed },
      'Processed inbound webhook delivery',
    );

    return { received: true, eventsProcessed };
  }
}
