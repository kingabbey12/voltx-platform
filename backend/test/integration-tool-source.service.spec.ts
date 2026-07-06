import { IntegrationToolSourceService } from '../src/modules/integrations/tools/integration-tool-source.service';

describe('IntegrationToolSourceService', () => {
  let toolRegistry: { registerDynamicSource: jest.Mock };
  let integrationProviderRegistry: { list: jest.Mock };
  let integrationDispatcherService: { execute: jest.Mock };
  let service: IntegrationToolSourceService;

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() };
    integrationProviderRegistry = { list: jest.fn() };
    integrationDispatcherService = { execute: jest.fn() };
    service = new IntegrationToolSourceService(
      toolRegistry as never,
      integrationProviderRegistry as never,
      integrationDispatcherService as never,
    );
  });

  it('registers itself as a dynamic tool source on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('generates one namespaced AITool per (provider, action) pair', () => {
    integrationProviderRegistry.list.mockReturnValue([
      {
        key: 'SLACK',
        displayName: 'Slack',
        listActions: () => [
          {
            name: 'post_message',
            description: 'Post a message.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'list_channels',
            description: 'List channels.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
      {
        key: 'GITHUB',
        displayName: 'GitHub',
        listActions: () => [
          {
            name: 'create_issue',
            description: 'Create an issue.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    ]);

    const tools = service.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'integration_github_create_issue',
      'integration_slack_list_channels',
      'integration_slack_post_message',
    ]);
    expect(
      tools.find((tool) => tool.name === 'integration_slack_post_message')?.description,
    ).toContain('[Slack]');
  });

  it("a generated tool's execute() dispatches through IntegrationDispatcherService with the resolved provider/action", async () => {
    integrationProviderRegistry.list.mockReturnValue([
      {
        key: 'SLACK',
        displayName: 'Slack',
        listActions: () => [
          {
            name: 'post_message',
            description: 'Post a message.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    ]);
    integrationDispatcherService.execute.mockResolvedValue({ ts: '123' });

    const [tool] = service.listTools();
    const controller = new AbortController();
    const result = await tool.execute(
      { channel: '#general', text: 'hi' },
      { conversationId: 'conv-1', signal: controller.signal },
    );

    expect(result).toEqual({ ts: '123' });
    expect(integrationDispatcherService.execute).toHaveBeenCalledWith({
      provider: 'SLACK',
      actionName: 'post_message',
      input: { channel: '#general', text: 'hi' },
      connectionId: undefined,
      signal: controller.signal,
    });
  });

  it('forwards an explicit connectionId from the tool input when provided', async () => {
    integrationProviderRegistry.list.mockReturnValue([
      {
        key: 'SLACK',
        displayName: 'Slack',
        listActions: () => [
          {
            name: 'post_message',
            description: 'Post a message.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    ]);
    integrationDispatcherService.execute.mockResolvedValue({});

    const [tool] = service.listTools();
    await tool.execute(
      { channel: '#general', text: 'hi', connectionId: 'conn-42' },
      { conversationId: 'conv-1', signal: new AbortController().signal },
    );

    expect(integrationDispatcherService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'conn-42' }),
    );
  });

  it('returns an empty tool list when no providers are registered', () => {
    integrationProviderRegistry.list.mockReturnValue([]);
    expect(service.listTools()).toEqual([]);
  });
});
