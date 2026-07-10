import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { OAuthService } from '../../integrations/oauth/oauth.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { CommsCredentialValue } from '../channels/channel-provider.interface';
import {
  ChannelConnectionRepository,
  FindCommsChannelConnectionsParams,
  PaginatedCommsChannelConnections,
} from './channel-connection.repository';
import { CommsChannelCredentialRepository } from './channel-credential.repository';
import { CommsChannelConnectionEntity } from './entities/channel-connection.entity';

const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface InitiateChannelOAuthRequest {
  channel: string;
  displayName: string;
  redirectUri: string;
  createdBy: string;
}

export interface CompleteChannelOAuthRequest {
  connectionId: string;
  code: string;
  redirectUri: string;
}

export interface CreateApiKeyChannelConnectionRequest {
  channel: string;
  displayName: string;
  credential: CommsCredentialValue;
  externalAccountId?: string;
  createdBy: string;
}

@Injectable()
export class ChannelConnectionService {
  private readonly logger = new Logger(ChannelConnectionService.name);

  constructor(
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelCredentialRepository: CommsChannelCredentialRepository,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly oauthService: OAuthService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  async initiateOAuth(
    request: InitiateChannelOAuthRequest,
  ): Promise<{ connectionId: string; authorizationUrl: string }> {
    const provider = this.channelProviderRegistry.get(request.channel as never);
    if (!provider.oauthConfig) {
      throw new BadRequestException(`Channel "${request.channel}" does not use OAuth2`);
    }

    const connection = await this.channelConnectionRepository.create({
      channel: provider.channel,
      displayName: request.displayName,
      createdBy: request.createdBy,
    });

    const authorizationUrl = this.oauthService.buildAuthorizationUrl(
      provider.oauthConfig,
      connection.id,
      request.redirectUri,
    );

    await this.auditService.record({
      action: 'communications.oauth.initiated',
      resource: 'comms_channel_connection',
      resourceId: connection.id,
      metadata: { channel: provider.channel },
    });

    return { connectionId: connection.id, authorizationUrl };
  }

  async completeOAuth(request: CompleteChannelOAuthRequest): Promise<CommsChannelConnectionEntity> {
    const connection = await this.channelConnectionRepository.findById(request.connectionId);
    if (!connection) {
      throw new NotFoundException(`Channel connection "${request.connectionId}" not found`);
    }

    const provider = this.channelProviderRegistry.get(connection.channel);
    if (!provider.oauthConfig) {
      throw new BadRequestException(`Channel "${connection.channel}" does not use OAuth2`);
    }

    const token = await this.oauthService.exchangeCodeForToken(
      provider.oauthConfig,
      request.code,
      request.redirectUri,
    );

    const credential: CommsCredentialValue = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      extra: token.extra,
    };

    await this.channelCredentialRepository.upsert({
      connectionId: connection.id,
      encryptedPayload: this.encryptionService.encryptJson(
        credential as unknown as Record<string, unknown>,
      ),
      expiresAt: token.expiresAt ?? null,
    });

    const externalAccountId = await provider.resolveAccountIdentity?.(credential);

    const updated = await this.channelConnectionRepository.update(connection.id, {
      status: 'CONNECTED',
      lastError: null,
      ...(externalAccountId ? { externalAccountId } : {}),
    });

    await this.auditService.record({
      action: 'communications.connection.connected',
      resource: 'comms_channel_connection',
      resourceId: connection.id,
      metadata: { channel: connection.channel },
    });

    return updated;
  }

  /**
   * Connects a non-OAuth channel (WhatsApp Business Cloud API access
   * token + phone number id, Twilio Account SID/Auth Token) directly with
   * caller-supplied credentials — mirrors
   * IntegrationConnectionService.createApiKeyConnection's shape exactly.
   */
  async createApiKeyConnection(
    request: CreateApiKeyChannelConnectionRequest,
  ): Promise<CommsChannelConnectionEntity> {
    const provider = this.channelProviderRegistry.get(request.channel as never);
    if (provider.authType !== 'API_KEY') {
      throw new BadRequestException(
        `Channel "${request.channel}" requires the OAuth2 connect flow`,
      );
    }

    const connection = await this.channelConnectionRepository.create({
      channel: provider.channel,
      displayName: request.displayName,
      createdBy: request.createdBy,
      externalAccountId: request.externalAccountId,
    });

    await this.channelCredentialRepository.upsert({
      connectionId: connection.id,
      encryptedPayload: this.encryptionService.encryptJson(
        request.credential as unknown as Record<string, unknown>,
      ),
      expiresAt: null,
    });

    const externalAccountId =
      request.externalAccountId ?? (await provider.resolveAccountIdentity?.(request.credential));

    const updated = await this.channelConnectionRepository.update(connection.id, {
      status: 'CONNECTED',
      lastError: null,
      ...(externalAccountId ? { externalAccountId } : {}),
    });

    await this.auditService.record({
      action: 'communications.connection.connected',
      resource: 'comms_channel_connection',
      resourceId: connection.id,
      metadata: { channel: connection.channel, authType: 'API_KEY' },
    });

    return updated;
  }

  async listConnections(
    params: FindCommsChannelConnectionsParams,
  ): Promise<PaginatedCommsChannelConnections> {
    return this.channelConnectionRepository.findAll(params);
  }

  async getConnectionOrThrow(id: string): Promise<CommsChannelConnectionEntity> {
    const connection = await this.channelConnectionRepository.findById(id);
    if (!connection) {
      throw new NotFoundException(`Channel connection "${id}" not found`);
    }
    return connection;
  }

  async disconnect(id: string): Promise<void> {
    const connection = await this.getConnectionOrThrow(id);
    await this.channelCredentialRepository.delete(id).catch(() => undefined);
    await this.channelConnectionRepository.softDelete(id);
    await this.auditService.record({
      action: 'communications.connection.disconnected',
      resource: 'comms_channel_connection',
      resourceId: connection.id,
      metadata: { channel: connection.channel },
    });
  }

  /**
   * Transparent, proactive refresh-before-expiry — mirrors
   * IntegrationDispatcherService.getValidCredential exactly. Every channel
   * provider call (send, poll) goes through this rather than reading the
   * stored credential directly, so a token never gets used within 60s of
   * expiring.
   */
  async getValidCredential(
    connection: CommsChannelConnectionEntity,
  ): Promise<CommsCredentialValue> {
    const record = await this.channelCredentialRepository.findByConnectionIdUnscoped(connection.id);
    if (!record) {
      throw new BadRequestException(`Connection "${connection.id}" has no stored credential`);
    }

    const credential = this.encryptionService.decryptJson<CommsCredentialValue>(
      record.encryptedPayload,
    );
    const isExpiringSoon =
      record.expiresAt && record.expiresAt.getTime() - Date.now() < TOKEN_REFRESH_SKEW_MS;

    if (!isExpiringSoon) {
      return credential;
    }
    return this.refreshCredential(connection, credential);
  }

  private async refreshCredential(
    connection: CommsChannelConnectionEntity,
    credential: CommsCredentialValue,
  ): Promise<CommsCredentialValue> {
    if (!credential.refreshToken) {
      return credential;
    }

    const provider = this.channelProviderRegistry.get(connection.channel);
    if (!provider.oauthConfig) {
      return credential;
    }

    const refreshed = await this.oauthService.refreshAccessToken(
      provider.oauthConfig,
      credential.refreshToken,
    );
    const nextCredential: CommsCredentialValue = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? credential.refreshToken,
      tokenType: refreshed.tokenType,
      expiresAt: refreshed.expiresAt,
      extra: refreshed.extra,
    };

    await this.channelCredentialRepository.upsert({
      connectionId: connection.id,
      encryptedPayload: this.encryptionService.encryptJson(
        nextCredential as unknown as Record<string, unknown>,
      ),
      expiresAt: refreshed.expiresAt ?? null,
    });

    this.logger.log(
      { connectionId: connection.id, channel: connection.channel },
      'Refreshed comms channel OAuth token',
    );

    return nextCredential;
  }
}
