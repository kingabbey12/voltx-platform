import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IntegrationDispatcherService } from '../src/modules/integrations/dispatch/integration-dispatcher.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { IntegrationConnectionEntity } from '../src/modules/integrations/entities/integration-connection.entity';

function connectionFixture(
  overrides: Partial<IntegrationConnectionEntity> = {},
): IntegrationConnectionEntity {
  return {
    id: 'conn-1',
    organizationId: 'org-1',
    provider: 'SLACK',
    displayName: 'Team Slack',
    authType: 'OAUTH2',
    status: 'CONNECTED',
    externalAccountId: null,
    config: {},
    version: 0,
    lastHealthCheckAt: null,
    lastHealthStatus: 'UNKNOWN',
    lastSyncAt: null,
    lastError: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('IntegrationDispatcherService', () => {
  let integrationConnectionRepository: {
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
  };
  let integrationCredentialRepository: { findByConnectionId: jest.Mock; upsert: jest.Mock };
  let integrationApiUsageLogRepository: { create: jest.Mock };
  let integrationEventBusService: { publish: jest.Mock };
  let integrationProviderRegistry: { get: jest.Mock };
  let oauthService: { refreshAccessToken: jest.Mock };
  let encryptionService: EncryptionService;
  let service: IntegrationDispatcherService;

  beforeEach(() => {
    integrationConnectionRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };
    integrationCredentialRepository = { findByConnectionId: jest.fn(), upsert: jest.fn() };
    integrationApiUsageLogRepository = { create: jest.fn().mockResolvedValue(undefined) };
    integrationEventBusService = { publish: jest.fn() };
    integrationProviderRegistry = { get: jest.fn() };
    oauthService = { refreshAccessToken: jest.fn() };
    encryptionService = new EncryptionService({ get: () => 'test-key-0123456789' } as never);
    encryptionService.onModuleInit();

    service = new IntegrationDispatcherService(
      integrationConnectionRepository as never,
      integrationCredentialRepository as never,
      integrationApiUsageLogRepository as never,
      integrationEventBusService as never,
      integrationProviderRegistry as never,
      oauthService as never,
      encryptionService,
    );
  });

  describe('resolveConnection', () => {
    it('returns the connection by id when connectionId is provided', async () => {
      const connection = connectionFixture();
      integrationConnectionRepository.findById.mockResolvedValue(connection);

      const result = await service.resolveConnection('SLACK', 'conn-1');
      expect(result).toBe(connection);
    });

    it('throws NotFoundException when the explicit connectionId does not match the provider', async () => {
      integrationConnectionRepository.findById.mockResolvedValue(
        connectionFixture({ provider: 'GITHUB' }),
      );
      await expect(service.resolveConnection('SLACK', 'conn-1')).rejects.toThrow(NotFoundException);
    });

    it('auto-resolves the single connected connection when no id is given', async () => {
      const connection = connectionFixture();
      integrationConnectionRepository.findAll.mockResolvedValue({ items: [connection], total: 1 });
      const result = await service.resolveConnection('SLACK');
      expect(result).toBe(connection);
    });

    it('throws NotFoundException when no connected connection exists', async () => {
      integrationConnectionRepository.findAll.mockResolvedValue({ items: [], total: 0 });
      await expect(service.resolveConnection('SLACK')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when multiple connections exist and none is specified', async () => {
      integrationConnectionRepository.findAll.mockResolvedValue({
        items: [connectionFixture({ id: 'a' }), connectionFixture({ id: 'b' })],
        total: 2,
      });
      await expect(service.resolveConnection('SLACK')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getValidCredential', () => {
    it('returns the decrypted credential unchanged when not expiring soon', async () => {
      const credential = { accessToken: 'token-abc', refreshToken: 'refresh-abc' };
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson(credential),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await service.getValidCredential(connectionFixture());
      expect(result.accessToken).toBe('token-abc');
      expect(oauthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('transparently refreshes when the token is expiring soon', async () => {
      const credential = { accessToken: 'old-token', refreshToken: 'refresh-abc' };
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson(credential),
        expiresAt: new Date(Date.now() + 1000),
      });
      integrationProviderRegistry.get.mockReturnValue({
        oauthConfig: {
          clientId: 'x',
          clientSecret: 'y',
          authorizationUrl: '',
          tokenUrl: '',
          scopes: [],
        },
      });
      oauthService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const result = await service.getValidCredential(connectionFixture());

      expect(result.accessToken).toBe('new-token');
      expect(integrationCredentialRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'conn-1' }),
      );
      expect(integrationEventBusService.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TOKEN_REFRESHED' }),
      );
    });

    it('throws BadRequestException when no credential exists for an authenticated connection', async () => {
      integrationCredentialRepository.findByConnectionId.mockResolvedValue(null);
      await expect(service.getValidCredential(connectionFixture())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns an empty credential for NONE auth type with no stored credential', async () => {
      integrationCredentialRepository.findByConnectionId.mockResolvedValue(null);
      const result = await service.getValidCredential(connectionFixture({ authType: 'NONE' }));
      expect(result).toEqual({});
    });
  });

  describe('forceRefreshCredential', () => {
    it('refreshes regardless of expiry', async () => {
      const credential = { accessToken: 'old-token', refreshToken: 'refresh-abc' };
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson(credential),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      integrationProviderRegistry.get.mockReturnValue({
        oauthConfig: {
          clientId: 'x',
          clientSecret: 'y',
          authorizationUrl: '',
          tokenUrl: '',
          scopes: [],
        },
      });
      oauthService.refreshAccessToken.mockResolvedValue({
        accessToken: 'forced-new-token',
        tokenType: 'Bearer',
      });

      const result = await service.forceRefreshCredential(connectionFixture());
      expect(result.accessToken).toBe('forced-new-token');
    });
  });

  describe('execute', () => {
    it('resolves the connection, executes the action, and records success usage', async () => {
      const connection = connectionFixture();
      integrationConnectionRepository.findById.mockResolvedValue(connection);
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson({ accessToken: 'token' }),
        expiresAt: null,
      });
      const executeAction = jest.fn().mockResolvedValue({ ok: true });
      integrationProviderRegistry.get.mockReturnValue({ executeAction });

      const result = await service.execute({
        provider: 'SLACK',
        actionName: 'post_message',
        input: { channel: '#general', text: 'hi' },
        connectionId: connection.id,
      });

      expect(result).toEqual({ ok: true });
      expect(executeAction).toHaveBeenCalledWith(
        'post_message',
        { channel: '#general', text: 'hi' },
        expect.objectContaining({ organizationId: 'org-1', connectionId: 'conn-1' }),
      );
      expect(integrationApiUsageLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'post_message', statusCode: 200 }),
      );
    });

    it('records failure usage and marks the connection ERROR when the action throws', async () => {
      const connection = connectionFixture();
      integrationConnectionRepository.findById.mockResolvedValue(connection);
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson({ accessToken: 'token' }),
        expiresAt: null,
      });
      integrationProviderRegistry.get.mockReturnValue({
        executeAction: jest.fn().mockRejectedValue(new Error('provider exploded')),
      });

      await expect(
        service.execute({
          provider: 'SLACK',
          actionName: 'post_message',
          input: {},
          connectionId: connection.id,
        }),
      ).rejects.toThrow('provider exploded');

      expect(integrationApiUsageLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'provider exploded' }),
      );
      expect(integrationConnectionRepository.update).toHaveBeenCalledWith(
        connection.id,
        expect.objectContaining({ status: 'ERROR', lastError: 'provider exploded' }),
      );
    });

    it('clears the ERROR status back to CONNECTED after a subsequent successful call', async () => {
      const connection = connectionFixture({ status: 'ERROR' });
      integrationConnectionRepository.findById.mockResolvedValue(connection);
      integrationCredentialRepository.findByConnectionId.mockResolvedValue({
        encryptedPayload: encryptionService.encryptJson({ accessToken: 'token' }),
        expiresAt: null,
      });
      integrationProviderRegistry.get.mockReturnValue({
        executeAction: jest.fn().mockResolvedValue({}),
      });

      await service.execute({
        provider: 'SLACK',
        actionName: 'post_message',
        input: {},
        connectionId: connection.id,
      });

      expect(integrationConnectionRepository.update).toHaveBeenCalledWith(
        connection.id,
        expect.objectContaining({ status: 'CONNECTED', lastError: null }),
      );
    });
  });
});
