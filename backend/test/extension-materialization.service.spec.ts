import { ExtensionMaterializationService } from '../src/modules/extensions/extension-materialization.service';
import { ExtensionRepository } from '../src/modules/extensions/extension.repository';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';

describe('ExtensionMaterializationService', () => {
  let repository: jest.Mocked<ExtensionRepository>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let service: ExtensionMaterializationService;

  beforeEach(() => {
    repository = {
      createPages: jest.fn(),
      createWidgets: jest.fn(),
      createNavEntries: jest.fn(),
      createAiTools: jest.fn(),
      findPriorAiToolByName: jest.fn().mockResolvedValue(null),
    } as never;
    encryptionService = {
      encrypt: jest.fn((value: string) => `encrypted(${value})`),
      decrypt: jest.fn(),
    } as never;

    service = new ExtensionMaterializationService(repository, encryptionService);
  });

  it('materializes pages, widgets, and nav entries from the manifest', async () => {
    await service.materializeFromVersion('app-1', 'version-1', {
      pages: [{ path: '/dashboard', title: 'Dashboard', root: { type: 'section' } }],
      widgets: [{ placement: 'DASHBOARD', root: { type: 'stat-card' } }],
      navEntries: [{ label: 'My App', targetPath: '/dashboard' }],
    });

    expect(repository.createPages).toHaveBeenCalledWith('version-1', [
      {
        path: '/dashboard',
        manifest: { path: '/dashboard', title: 'Dashboard', root: { type: 'section' } },
      },
    ]);
    expect(repository.createWidgets).toHaveBeenCalledWith('version-1', [
      { placement: 'DASHBOARD', manifest: { placement: 'DASHBOARD', root: { type: 'stat-card' } } },
    ]);
    expect(repository.createNavEntries).toHaveBeenCalledWith('version-1', [
      { label: 'My App', icon: undefined, targetPath: '/dashboard' },
    ]);
  });

  it('treats a missing manifest section as empty', async () => {
    await service.materializeFromVersion('app-1', 'version-1', {});

    expect(repository.createPages).toHaveBeenCalledWith('version-1', []);
    expect(repository.createWidgets).toHaveBeenCalledWith('version-1', []);
    expect(repository.createNavEntries).toHaveBeenCalledWith('version-1', []);
    expect(repository.createAiTools).toHaveBeenCalledWith('version-1', []);
  });

  describe('aiTools signing secret continuity', () => {
    const tool = {
      name: 'lookup_order',
      description: 'Looks up an order',
      parametersSchema: { type: 'object' },
      responseSchema: { type: 'object' },
      endpointUrl: 'https://acme.example/tool',
    };

    it('generates a brand-new signing secret for a tool name never seen before', async () => {
      repository.findPriorAiToolByName.mockResolvedValue(null);

      await service.materializeFromVersion('app-1', 'version-2', { aiTools: [tool] });

      expect(encryptionService.encrypt).toHaveBeenCalled();
      const [, createdAiTools] = repository.createAiTools.mock.calls[0];
      expect(createdAiTools[0].name).toBe('lookup_order');
      expect(createdAiTools[0].encryptedSigningSecret).toContain('encrypted(');
    });

    it("reuses the prior version's signing secret for a same-named tool", async () => {
      repository.findPriorAiToolByName.mockResolvedValue({
        id: 'prior-tool',
        marketplaceAppVersionId: 'version-1',
        name: 'lookup_order',
        description: 'old',
        parametersSchema: {},
        responseSchema: {},
        endpointUrl: 'https://acme.example/old',
        encryptedSigningSecret: 'existing-ciphertext',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.materializeFromVersion('app-1', 'version-2', { aiTools: [tool] });

      expect(encryptionService.encrypt).not.toHaveBeenCalled();
      expect(repository.createAiTools).toHaveBeenCalledWith('version-2', [
        expect.objectContaining({ encryptedSigningSecret: 'existing-ciphertext' }),
      ]);
    });
  });
});
