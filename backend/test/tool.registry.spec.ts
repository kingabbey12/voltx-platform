import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AI_TOOLS, AITool } from '../src/modules/ai/tools/tool.interface';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const tools: AITool[] = [
    {
      name: 'calculator',
      description: 'Evaluate math expressions',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Expression to evaluate',
            required: true,
          },
        },
      },
      execute: jest.fn(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistry,
        {
          provide: AI_TOOLS,
          useValue: tools,
        },
      ],
    }).compile();

    registry = module.get(ToolRegistry);
  });

  it('lists registered tools', () => {
    const result = registry.list();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('calculator');
  });

  it('throws for unknown tools', () => {
    expect(() => registry.get('missing')).toThrow(NotFoundException);
  });

  describe('registerDynamicSource', () => {
    const dynamicTool: AITool = {
      name: 'integration_slack_post_message',
      description: '[Slack] Post a message.',
      inputSchema: { type: 'object', properties: {} },
      execute: jest.fn(),
    };

    it('includes tools from a registered dynamic source in list()', () => {
      registry.registerDynamicSource({ listTools: () => [dynamicTool] });
      const names = registry.list().map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining(['calculator', 'integration_slack_post_message']),
      );
    });

    it('resolves a dynamic tool by name via get()', () => {
      registry.registerDynamicSource({ listTools: () => [dynamicTool] });
      expect(registry.get('integration_slack_post_message')).toBe(dynamicTool);
    });

    it('still resolves static tools when a dynamic source is registered', () => {
      registry.registerDynamicSource({ listTools: () => [dynamicTool] });
      expect(registry.get('calculator')).toBe(tools[0]);
    });

    it('merges tools from multiple dynamic sources', () => {
      const secondTool: AITool = { ...dynamicTool, name: 'integration_github_create_issue' };
      registry.registerDynamicSource({ listTools: () => [dynamicTool] });
      registry.registerDynamicSource({ listTools: () => [secondTool] });
      const names = registry.list().map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'integration_slack_post_message',
          'integration_github_create_issue',
        ]),
      );
    });
  });
});
