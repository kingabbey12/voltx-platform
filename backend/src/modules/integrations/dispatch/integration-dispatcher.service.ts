import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IntegrationConnectionRepository } from '../integration-connection.repository';
import { IntegrationCredentialRepository } from '../integration-credential.repository';
import { IntegrationApiUsageLogRepository } from '../integration-api-usage-log.repository';
import { IntegrationEventBusService } from '../events/integration-event-bus.service';
import { OAuthService } from '../oauth/oauth.service';
import { EncryptionService } from '../security/encryption.service';
import { IntegrationProviderRegistry } from '../provider/integration-provider.registry';
import {
  IntegrationActionContext,
  IntegrationCredentialValue,
  IntegrationProviderKey,
} from '../provider/integration-provider.types';
import { IntegrationConnectionEntity } from '../entities/integration-connection.entity';

const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface ExecuteIntegrationActionParams {
  provider: IntegrationProviderKey;
  actionName: string;
  input: Record<string, unknown>;
  connectionId?: string;
  signal?: AbortSignal;
}

/**
 * The single place that resolves a connection, decrypts/refreshes its
 * credential, invokes the provider, and records usage telemetry — both
 * the workflow INTEGRATION step executor and the AI tool adapter call
 * through here rather than each reimplementing "find connection, refresh
 * token if stale, call provider, log the call".
 */
@Injectable()
export class IntegrationDispatcherService {
  private readonly logger = new Logger(IntegrationDispatcherService.name);

  constructor(
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationCredentialRepository: IntegrationCredentialRepository,
    private readonly integrationApiUsageLogRepository: IntegrationApiUsageLogRepository,
    private readonly integrationEventBusService: IntegrationEventBusService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly oauthService: OAuthService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async resolveConnection(
    provider: IntegrationProviderKey,
    connectionId?: string,
  ): Promise<IntegrationConnectionEntity> {
    if (connectionId) {
      const connection = await this.integrationConnectionRepository.findById(connectionId);
      if (!connection || connection.provider !== provider) {
        throw new NotFoundException(
          `Integration connection "${connectionId}" not found for ${provider}`,
        );
      }
      return connection;
    }

    const { items } = await this.integrationConnectionRepository.findAll({
      page: 1,
      limit: 2,
      provider,
      status: 'CONNECTED',
    });

    if (items.length === 0) {
      throw new NotFoundException(
        `No connected ${provider} integration found for this organization`,
      );
    }
    if (items.length > 1) {
      throw new BadRequestException(
        `Multiple ${provider} connections exist — specify connectionId explicitly`,
      );
    }
    return items[0];
  }

  async execute(params: ExecuteIntegrationActionParams): Promise<unknown> {
    const connection = await this.resolveConnection(params.provider, params.connectionId);
    const provider = this.integrationProviderRegistry.get(params.provider);
    const credential = await this.getValidCredential(connection);
    const startedAt = Date.now();

    try {
      const result = await provider.executeAction(params.actionName, params.input, {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        credential,
        signal: params.signal,
      } satisfies IntegrationActionContext);

      await this.recordUsage(connection, params.actionName, Date.now() - startedAt, 200);
      if (connection.status !== 'CONNECTED') {
        await this.integrationConnectionRepository.update(connection.id, {
          status: 'CONNECTED',
          lastError: null,
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown integration error';
      await this.recordUsage(
        connection,
        params.actionName,
        Date.now() - startedAt,
        undefined,
        message,
      );
      await this.integrationConnectionRepository.update(connection.id, {
        status: 'ERROR',
        lastError: message,
      });
      throw error;
    }
  }

  /** Decrypts the connection's credential, transparently refreshing it first if it's expired or about to expire. */
  async getValidCredential(
    connection: IntegrationConnectionEntity,
  ): Promise<IntegrationCredentialValue> {
    const record = await this.integrationCredentialRepository.findByConnectionId(connection.id);
    if (!record) {
      if (connection.authType === 'NONE') {
        return {};
      }
      throw new BadRequestException(`Connection "${connection.id}" has no stored credential`);
    }

    const credential = this.encryptionService.decryptJson<IntegrationCredentialValue>(
      record.encryptedPayload,
    );
    const isExpiringSoon =
      record.expiresAt && record.expiresAt.getTime() - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiringSoon) {
      return credential;
    }
    return this.refreshCredential(connection, credential);
  }

  /** Used by the admin "Refresh Token" endpoint — refreshes unconditionally rather than only when nearing expiry. */
  async forceRefreshCredential(
    connection: IntegrationConnectionEntity,
  ): Promise<IntegrationCredentialValue> {
    const record = await this.integrationCredentialRepository.findByConnectionId(connection.id);
    if (!record) {
      throw new BadRequestException(`Connection "${connection.id}" has no stored credential`);
    }
    const credential = this.encryptionService.decryptJson<IntegrationCredentialValue>(
      record.encryptedPayload,
    );
    return this.refreshCredential(connection, credential);
  }

  private async refreshCredential(
    connection: IntegrationConnectionEntity,
    credential: IntegrationCredentialValue,
  ): Promise<IntegrationCredentialValue> {
    if (connection.authType !== 'OAUTH2' || !credential.refreshToken) {
      return credential;
    }

    const provider = this.integrationProviderRegistry.get(connection.provider);
    if (!provider.oauthConfig) {
      return credential;
    }

    const refreshed = await this.oauthService.refreshAccessToken(
      provider.oauthConfig,
      credential.refreshToken,
    );
    const nextCredential: IntegrationCredentialValue = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? credential.refreshToken,
      tokenType: refreshed.tokenType,
      expiresAt: refreshed.expiresAt,
      extra: refreshed.extra,
    };

    await this.integrationCredentialRepository.upsert({
      connectionId: connection.id,
      encryptedPayload: this.encryptionService.encryptJson(
        nextCredential as unknown as Record<string, unknown>,
      ),
      expiresAt: refreshed.expiresAt ?? null,
    });

    this.integrationEventBusService.publish({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      type: 'TOKEN_REFRESHED',
      payload: { provider: connection.provider },
      occurredAt: new Date().toISOString(),
    });

    this.logger.log(
      { connectionId: connection.id, provider: connection.provider },
      'Refreshed OAuth token',
    );

    return nextCredential;
  }

  private async recordUsage(
    connection: IntegrationConnectionEntity,
    action: string,
    durationMs: number,
    statusCode?: number,
    error?: string,
  ): Promise<void> {
    await this.integrationApiUsageLogRepository.create({
      organizationId: connection.organizationId,
      connectionId: connection.id,
      action,
      statusCode,
      durationMs,
      error,
    });
  }
}
