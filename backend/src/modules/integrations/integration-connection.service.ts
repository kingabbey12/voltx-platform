import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { IntegrationConnectionRepository } from './integration-connection.repository';
import { IntegrationCredentialRepository } from './integration-credential.repository';
import { IntegrationWebhookEndpointRepository } from './integration-webhook-endpoint.repository';
import { IntegrationEventRepository } from './integration-event.repository';
import { IntegrationSyncRunRepository } from './integration-sync-run.repository';
import { IntegrationHealthCheckRepository } from './integration-health-check.repository';
import { IntegrationApiUsageLogRepository } from './integration-api-usage-log.repository';
import { IntegrationEventBusService } from './events/integration-event-bus.service';
import { IntegrationKnowledgeContributorService } from './knowledge/integration-knowledge-contributor.service';
import { IntegrationDispatcherService } from './dispatch/integration-dispatcher.service';
import { OAuthService } from './oauth/oauth.service';
import { EncryptionService } from './security/encryption.service';
import { IntegrationProviderRegistry } from './provider/integration-provider.registry';
import {
  IntegrationActionContext,
  IntegrationCredentialValue,
  IntegrationProviderKey,
} from './provider/integration-provider.types';
import { IntegrationConnectionEntity } from './entities/integration-connection.entity';

export interface InitiateOAuthRequest {
  provider: IntegrationProviderKey;
  displayName: string;
  redirectUri: string;
}

export interface CompleteOAuthRequest {
  connectionId: string;
  code: string;
  redirectUri: string;
}

export interface CreateApiKeyConnectionRequest {
  provider: IntegrationProviderKey;
  displayName: string;
  apiKey?: string;
  webhookSecret?: string;
  externalAccountId?: string;
}

export interface UpdateConnectionRequest {
  displayName?: string;
  config?: Record<string, unknown>;
}

@Injectable()
export class IntegrationConnectionService {
  constructor(
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationCredentialRepository: IntegrationCredentialRepository,
    private readonly integrationWebhookEndpointRepository: IntegrationWebhookEndpointRepository,
    private readonly integrationEventRepository: IntegrationEventRepository,
    private readonly integrationSyncRunRepository: IntegrationSyncRunRepository,
    private readonly integrationHealthCheckRepository: IntegrationHealthCheckRepository,
    private readonly integrationApiUsageLogRepository: IntegrationApiUsageLogRepository,
    private readonly integrationEventBusService: IntegrationEventBusService,
    private readonly integrationKnowledgeContributorService: IntegrationKnowledgeContributorService,
    private readonly integrationDispatcherService: IntegrationDispatcherService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly oauthService: OAuthService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Step 1 of the OAuth flow: creates a PENDING connection (its id doubles
   * as the OAuth `state` — unguessable, unique, already tenant-scoped)
   * and returns the provider's authorization URL. The provider's redirect
   * URI is expected to point at the FRONTEND app, which then calls
   * completeOAuth (authenticated, same as every other admin endpoint)
   * with the code it received — this avoids needing an unauthenticated
   * backend callback endpoint, since an external OAuth redirect carries
   * no bearer token to satisfy tenant scoping with.
   */
  async initiateOAuth(
    request: InitiateOAuthRequest,
  ): Promise<{ connectionId: string; authorizationUrl: string }> {
    const provider = this.integrationProviderRegistry.get(request.provider);
    if (provider.authType !== 'OAUTH2' || !provider.oauthConfig) {
      throw new BadRequestException(`Provider "${request.provider}" does not use OAuth2`);
    }

    const tenant = this.tenantContextService.getOrThrow();
    const connection = await this.integrationConnectionRepository.create({
      provider: request.provider,
      displayName: request.displayName,
      authType: 'OAUTH2',
      createdBy: tenant.userId,
    });

    const authorizationUrl = this.oauthService.buildAuthorizationUrl(
      provider.oauthConfig,
      connection.id,
      request.redirectUri,
    );

    await this.auditService.record({
      action: 'integration.oauth.initiated',
      resource: 'integration_connection',
      resourceId: connection.id,
      metadata: { provider: request.provider },
    });

    return { connectionId: connection.id, authorizationUrl };
  }

  async completeOAuth(request: CompleteOAuthRequest): Promise<IntegrationConnectionEntity> {
    const connection = await this.integrationConnectionRepository.findById(request.connectionId);
    if (!connection) {
      throw new NotFoundException(`Integration connection "${request.connectionId}" not found`);
    }

    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.oauthConfig) {
      throw new BadRequestException(`Provider "${connection.provider}" does not use OAuth2`);
    }

    const token = await this.oauthService.exchangeCodeForToken(
      provider.oauthConfig,
      request.code,
      request.redirectUri,
    );

    const credential: IntegrationCredentialValue = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      extra: token.extra,
    };

    await this.integrationCredentialRepository.upsert({
      connectionId: connection.id,
      encryptedPayload: this.encryptionService.encryptJson(
        credential as unknown as Record<string, unknown>,
      ),
      expiresAt: token.expiresAt ?? null,
    });

    const updated = await this.integrationConnectionRepository.update(connection.id, {
      status: 'CONNECTED',
      lastError: null,
    });

    this.integrationEventBusService.publish({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      type: 'CONNECTION_CONNECTED',
      payload: { provider: connection.provider },
      occurredAt: new Date().toISOString(),
    });

    await this.auditService.record({
      action: 'integration.connection.connected',
      resource: 'integration_connection',
      resourceId: connection.id,
      metadata: { provider: connection.provider },
    });

    return updated;
  }

  async createApiKeyConnection(
    request: CreateApiKeyConnectionRequest,
  ): Promise<IntegrationConnectionEntity> {
    const provider = this.integrationProviderRegistry.get(request.provider);
    if (
      provider.authType !== 'API_KEY' &&
      provider.authType !== 'WEBHOOK_SECRET' &&
      provider.authType !== 'NONE'
    ) {
      throw new BadRequestException(
        `Provider "${request.provider}" requires the OAuth2 connect flow`,
      );
    }

    const tenant = this.tenantContextService.getOrThrow();
    const connection = await this.integrationConnectionRepository.create({
      provider: request.provider,
      displayName: request.displayName,
      authType: provider.authType,
      externalAccountId: request.externalAccountId,
      createdBy: tenant.userId,
    });

    if (provider.authType !== 'NONE') {
      const credential: IntegrationCredentialValue = {
        apiKey: request.apiKey,
        extra: request.webhookSecret ? { webhookSecret: request.webhookSecret } : undefined,
      };
      await this.integrationCredentialRepository.upsert({
        connectionId: connection.id,
        encryptedPayload: this.encryptionService.encryptJson(
          credential as unknown as Record<string, unknown>,
        ),
      });
    }

    const updated = await this.integrationConnectionRepository.update(connection.id, {
      status: 'CONNECTED',
    });

    await this.auditService.record({
      action: 'integration.connection.created',
      resource: 'integration_connection',
      resourceId: connection.id,
      metadata: { provider: request.provider, authType: provider.authType },
    });

    return updated;
  }

  async getConnectionOrThrow(id: string): Promise<IntegrationConnectionEntity> {
    const connection = await this.integrationConnectionRepository.findById(id);
    if (!connection) {
      throw new NotFoundException(`Integration connection "${id}" not found`);
    }
    return connection;
  }

  listConnections(params: {
    page: number;
    limit: number;
    provider?: IntegrationProviderKey;
    status?: IntegrationConnectionEntity['status'];
  }) {
    return this.integrationConnectionRepository.findAll(params);
  }

  async updateConnection(
    id: string,
    request: UpdateConnectionRequest,
  ): Promise<IntegrationConnectionEntity> {
    const connection = await this.getConnectionOrThrow(id);
    const updated = await this.integrationConnectionRepository.updateWithVersion(
      id,
      connection.version,
      {
        displayName: request.displayName,
        config: request.config,
      },
    );

    await this.auditService.record({
      action: 'integration.connection.updated',
      resource: 'integration_connection',
      resourceId: id,
    });

    return updated;
  }

  /** "Connection Revocation": stops using and deletes the stored credential — provider-side token invalidation varies too much per vendor to implement generically here, but Voltx never uses or stores the token again after this call. */
  async revokeConnection(id: string): Promise<IntegrationConnectionEntity> {
    await this.getConnectionOrThrow(id);
    await this.integrationCredentialRepository.delete(id).catch(() => undefined);
    const updated = await this.integrationConnectionRepository.update(id, { status: 'REVOKED' });

    await this.auditService.record({
      action: 'integration.connection.revoked',
      resource: 'integration_connection',
      resourceId: id,
    });

    return updated;
  }

  async deleteConnection(id: string): Promise<void> {
    await this.getConnectionOrThrow(id);
    await this.integrationCredentialRepository.delete(id).catch(() => undefined);
    await this.integrationConnectionRepository.softDelete(id);

    await this.auditService.record({
      action: 'integration.connection.deleted',
      resource: 'integration_connection',
      resourceId: id,
    });
  }

  /** "Reconnect": re-run the OAuth authorize step against an existing connection (its credential gets replaced on completeOAuth, not a new connection created). */
  async reconnect(id: string, redirectUri: string): Promise<{ authorizationUrl: string }> {
    const connection = await this.getConnectionOrThrow(id);
    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.oauthConfig) {
      throw new BadRequestException(
        `Provider "${connection.provider}" does not use OAuth2 — nothing to reconnect`,
      );
    }
    const authorizationUrl = this.oauthService.buildAuthorizationUrl(
      provider.oauthConfig,
      connection.id,
      redirectUri,
    );
    return { authorizationUrl };
  }

  async refreshToken(id: string): Promise<IntegrationConnectionEntity> {
    const connection = await this.getConnectionOrThrow(id);
    if (connection.authType !== 'OAUTH2') {
      throw new BadRequestException('This connection has no refreshable OAuth token');
    }

    await this.integrationDispatcherService.forceRefreshCredential(connection);
    return this.getConnectionOrThrow(id);
  }

  async checkHealth(
    id: string,
  ): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const connection = await this.getConnectionOrThrow(id);
    const provider = this.integrationProviderRegistry.get(connection.provider);
    const credential = await this.integrationDispatcherService.getValidCredential(connection);

    const result = await provider.checkHealth({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      credential,
    } satisfies IntegrationActionContext);

    await this.integrationHealthCheckRepository.create({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      status: result.healthy ? 'HEALTHY' : 'UNHEALTHY',
      latencyMs: result.latencyMs,
      message: result.message,
    });

    await this.integrationConnectionRepository.update(id, {
      lastHealthCheckAt: new Date(),
      lastHealthStatus: result.healthy ? 'HEALTHY' : 'UNHEALTHY',
      ...(result.healthy
        ? { status: 'CONNECTED', lastError: null }
        : { status: 'ERROR', lastError: result.message }),
    });

    // Health checks are a real outbound call to the provider, so they count
    // toward "API Usage" tracking too — kept separate from
    // IntegrationDispatcherService.execute()'s usage logging since a health
    // check isn't a connector action, but it should still appear in the
    // same API-usage log the "Connection Logs" endpoint exposes.
    await this.integrationApiUsageLogRepository.create({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      action: 'health_check',
      statusCode: result.healthy ? 200 : undefined,
      durationMs: result.latencyMs,
      error: result.healthy ? undefined : result.message,
    });

    return result;
  }

  async sync(id: string): Promise<{ itemsProcessed: number; itemsFailed: number; status: string }> {
    const connection = await this.getConnectionOrThrow(id);
    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.supportsPolling || !provider.poll) {
      throw new BadRequestException(
        `Provider "${connection.provider}" does not support polling sync`,
      );
    }

    const syncRun = await this.integrationSyncRunRepository.create({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      trigger: 'MANUAL',
    });

    const startedAt = Date.now();
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      const credential = await this.integrationDispatcherService.getValidCredential(connection);
      const cursor =
        typeof connection.config.syncCursor === 'string' ? connection.config.syncCursor : undefined;
      const result = await provider.poll(
        {
          organizationId: connection.organizationId,
          connectionId: connection.id,
          credential,
        } satisfies IntegrationActionContext,
        cursor,
      );

      for (const event of result.events) {
        try {
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
          itemsProcessed += 1;
        } catch {
          itemsFailed += 1;
        }
      }

      if (result.nextCursor) {
        await this.integrationConnectionRepository.update(connection.id, {
          config: { ...connection.config, syncCursor: result.nextCursor },
          lastSyncAt: new Date(),
        });
      }

      await this.integrationSyncRunRepository.update(syncRun.id, {
        status: itemsFailed > 0 ? 'PARTIAL' : 'SUCCEEDED',
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        itemsProcessed,
        itemsFailed,
      });

      return { itemsProcessed, itemsFailed, status: itemsFailed > 0 ? 'PARTIAL' : 'SUCCEEDED' };
    } catch (error) {
      await this.integrationSyncRunRepository.update(syncRun.id, {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        itemsProcessed,
        itemsFailed,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      });
      throw error;
    }
  }

  async registerWebhook(
    id: string,
    providedSecret?: string,
  ): Promise<{ webhookUrl: string; secret: string }> {
    const connection = await this.getConnectionOrThrow(id);
    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.supportsWebhooks) {
      throw new BadRequestException(`Provider "${connection.provider}" does not support webhooks`);
    }

    const secret = providedSecret ?? randomBytes(24).toString('hex');
    const token = randomUUID();

    await this.integrationWebhookEndpointRepository.create({
      connectionId: connection.id,
      provider: connection.provider,
      token,
      encryptedSecret: this.encryptionService.encrypt(secret),
    });

    const baseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    const webhookUrl = `${baseUrl}/api/v1/integrations/webhooks/${token}`;

    await this.auditService.record({
      action: 'integration.webhook.registered',
      resource: 'integration_connection',
      resourceId: connection.id,
    });

    return { webhookUrl, secret };
  }

  listWebhooks(connectionId: string) {
    return this.integrationWebhookEndpointRepository.listByConnection(connectionId);
  }

  listEvents(connectionId: string, page: number, limit: number) {
    return this.integrationEventRepository.listByConnection(connectionId, page, limit);
  }

  listSyncRuns(connectionId: string, page: number, limit: number) {
    return this.integrationSyncRunRepository.listByConnection(connectionId, page, limit);
  }

  listApiUsageLogs(connectionId: string, page: number, limit: number) {
    return this.integrationApiUsageLogRepository.listByConnection(connectionId, page, limit);
  }

  listHealthChecks(connectionId: string) {
    return this.integrationHealthCheckRepository.listByConnection(connectionId);
  }
}
