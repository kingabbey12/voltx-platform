import { NotFoundException } from '@nestjs/common';
import { MarketplaceAppExtensionService } from '../src/modules/marketplace/marketplace-app-extension.service';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { ExtensionRepository } from '../src/modules/extensions/extension.repository';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('MarketplaceAppExtensionService', () => {
  let appRepository: jest.Mocked<MarketplaceAppRepository>;
  let extensionRepository: jest.Mocked<ExtensionRepository>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let service: MarketplaceAppExtensionService;

  beforeEach(() => {
    appRepository = {
      findByIdInOrganization: jest.fn(),
      findLatestPublishedVersion: jest.fn(),
    } as never;
    extensionRepository = {
      listAiToolsForVersion: jest.fn(),
    } as never;
    encryptionService = {
      decrypt: jest.fn((value: string) => `plaintext(${value})`),
    } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;

    service = new MarketplaceAppExtensionService(
      appRepository,
      extensionRepository,
      encryptionService,
      tenantContextService,
    );
  });

  it('404s for an app the organization does not own', async () => {
    appRepository.findByIdInOrganization.mockResolvedValue(null);

    await expect(service.listAiTools('app-1', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty list when the app has no published version yet', async () => {
    appRepository.findByIdInOrganization.mockResolvedValue({ id: 'app-1' } as never);
    appRepository.findLatestPublishedVersion.mockResolvedValue(null);

    const result = await service.listAiTools('app-1', 'org-1');

    expect(result).toEqual([]);
    expect(extensionRepository.listAiToolsForVersion).not.toHaveBeenCalled();
  });

  it("decrypts each tool's signing secret for the owning developer", async () => {
    appRepository.findByIdInOrganization.mockResolvedValue({ id: 'app-1' } as never);
    appRepository.findLatestPublishedVersion.mockResolvedValue({ id: 'version-1' } as never);
    extensionRepository.listAiToolsForVersion.mockResolvedValue([
      {
        id: 'tool-1',
        marketplaceAppVersionId: 'version-1',
        name: 'lookup_order',
        description: 'x',
        parametersSchema: {},
        responseSchema: {},
        endpointUrl: 'https://acme.example/tool',
        encryptedSigningSecret: 'ciphertext-abc',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listAiTools('app-1', 'org-1');

    expect(encryptionService.decrypt).toHaveBeenCalledWith('ciphertext-abc');
    expect(result[0].signingSecret).toBe('plaintext(ciphertext-abc)');
  });
});
