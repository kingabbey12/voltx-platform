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
});
