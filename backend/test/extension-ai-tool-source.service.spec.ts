import { ToolExecutionError } from '../src/modules/ai/tools/tool.interface';
import { ExtensionAiToolSourceService } from '../src/modules/extensions/extension-ai-tool-source.service';
import { ExtensionRepository } from '../src/modules/extensions/extension.repository';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { OutboundHttpGuardService } from '../src/modules/ai/tools/outbound-http-guard.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ExtensionAiToolSourceService', () => {
  let toolRegistry: jest.Mocked<ToolRegistry>;
  let extensionRepository: jest.Mocked<ExtensionRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let outboundHttpGuard: jest.Mocked<OutboundHttpGuardService>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let configService: { get: jest.Mock };
  let service: ExtensionAiToolSourceService;

  const installedTool = {
    appId: 'app-1',
    tool: {
      id: 'tool-1',
      marketplaceAppVersionId: 'version-1',
      name: 'lookup_order',
      description: 'Looks up an order',
      parametersSchema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
      },
      responseSchema: {
        type: 'object',
        properties: { status: { type: 'string' } },
        required: ['status'],
      },
      endpointUrl: 'https://acme.example/tool',
      encryptedSigningSecret: 'ciphertext-abc',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() } as never;
    extensionRepository = {
      listActiveAiToolsForOrganization: jest.fn().mockResolvedValue([installedTool]),
    } as never;
    tenantContextService = { get: jest.fn().mockReturnValue({ organizationId: 'org-1' }) } as never;
    outboundHttpGuard = { fetch: jest.fn() } as never;
    encryptionService = { decrypt: jest.fn().mockReturnValue('plaintext-secret') } as never;
    configService = { get: jest.fn().mockReturnValue(10000) };

    service = new ExtensionAiToolSourceService(
      toolRegistry,
      extensionRepository,
      tenantContextService,
      outboundHttpGuard,
      encryptionService,
      configService as never,
    );
  });

  it('registers itself with the ToolRegistry on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('returns no tools when there is no organization in tenant context', () => {
    tenantContextService.get.mockReturnValue(undefined);
    expect(service.listTools()).toEqual([]);
    expect(extensionRepository.listActiveAiToolsForOrganization).not.toHaveBeenCalled();
  });

  it('lazily populates the cache in the background and exposes tools on a later call', async () => {
    expect(service.listTools()).toEqual([]);
    await flushMicrotasks();

    const tools = service.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe(`extension_app1_lookup_order`);
  });

  it('namespaces the tool name by appId to avoid cross-app collisions', async () => {
    service.listTools();
    await flushMicrotasks();
    const [tool] = service.listTools();
    expect(tool.name).toContain('app1');
    expect(tool.name).toContain('lookup_order');
  });

  describe('execute', () => {
    async function getExecutableTool() {
      service.listTools();
      await flushMicrotasks();
      const [tool] = service.listTools();
      return tool;
    }

    it('signs the request body and calls the developer endpoint via the SSRF guard', async () => {
      const tool = await getExecutableTool();
      (outboundHttpGuard.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'shipped' }),
      });

      const result = await tool.execute(
        { orderId: 'o-1' },
        { conversationId: 'c-1', signal: new AbortController().signal },
      );

      expect(encryptionService.decrypt).toHaveBeenCalledWith('ciphertext-abc');
      expect(outboundHttpGuard.fetch).toHaveBeenCalledWith(
        'https://acme.example/tool',
        expect.any(String),
        expect.objectContaining({ method: 'POST' }),
      );
      const [, , fetchInit] = (outboundHttpGuard.fetch as jest.Mock).mock.calls[0] as [
        string,
        string,
        { headers: Record<string, string> },
      ];
      expect(fetchInit.headers['X-Voltx-Signature']).toMatch(/^sha256=/);
      expect(result).toEqual({ status: 'shipped' });
    });

    it('throws when the endpoint responds with a non-2xx status', async () => {
      const tool = await getExecutableTool();
      (outboundHttpGuard.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 });

      await expect(
        tool.execute(
          { orderId: 'o-1' },
          { conversationId: 'c-1', signal: new AbortController().signal },
        ),
      ).rejects.toBeInstanceOf(ToolExecutionError);
    });

    it('throws when the response is not valid JSON', async () => {
      const tool = await getExecutableTool();
      (outboundHttpGuard.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('not json')),
      });

      await expect(
        tool.execute(
          { orderId: 'o-1' },
          { conversationId: 'c-1', signal: new AbortController().signal },
        ),
      ).rejects.toBeInstanceOf(ToolExecutionError);
    });

    it('rejects a response that does not match the declared responseSchema before returning it', async () => {
      const tool = await getExecutableTool();
      (outboundHttpGuard.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ wrongField: true }),
      });

      await expect(
        tool.execute(
          { orderId: 'o-1' },
          { conversationId: 'c-1', signal: new AbortController().signal },
        ),
      ).rejects.toBeInstanceOf(ToolExecutionError);
    });
  });
});
