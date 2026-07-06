import { Test, TestingModule } from '@nestjs/testing';
import { AgentPlannerService } from '../src/modules/ai/agents/autonomous/agent-planner.service';
import { AgentEntity } from '../src/modules/ai/agents/entities/agent.entity';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

describe('AgentPlannerService', () => {
  let service: AgentPlannerService;
  let aiGatewayService: jest.Mocked<AIGatewayService>;
  let toolRegistry: jest.Mocked<ToolRegistry>;

  const agent: AgentEntity = {
    id: 'agent-1',
    organizationId: 'org-1',
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a test agent.',
    provider: 'openai',
    model: 'gpt-5-mini',
    configuration: {},
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentPlannerService,
        {
          provide: AIGatewayService,
          useValue: { streamChat: jest.fn() },
        },
        {
          provide: ToolRegistry,
          useValue: {
            list: jest.fn().mockReturnValue([
              {
                name: 'datetime',
                description: 'time',
                inputSchema: { type: 'object', properties: {} },
              },
              {
                name: 'calculator',
                description: 'math',
                inputSchema: { type: 'object', properties: {} },
              },
            ]),
          },
        },
      ],
    }).compile();

    service = module.get(AgentPlannerService);
    aiGatewayService = module.get(AIGatewayService);
    toolRegistry = module.get(ToolRegistry);
  });

  function chatEventsFor(text: string) {
    return (async function* stream() {
      await Promise.resolve();
      yield {
        type: 'message_end' as const,
        provider: 'openai' as const,
        model: 'gpt-5-mini',
        outputText: text,
      };
    })();
  }

  it('parses a well-formed plan from the model', async () => {
    aiGatewayService.streamChat.mockImplementation(() =>
      chatEventsFor(JSON.stringify({ steps: ['Check the time', 'Report it'] })),
    );

    const plan = await service.createPlan({
      agent,
      objective: 'Find the time.',
      allowedToolNames: [],
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
    });

    expect(plan).toEqual({ objective: 'Find the time.', steps: ['Check the time', 'Report it'] });
  });

  it('caps the plan at a maximum number of steps', async () => {
    aiGatewayService.streamChat.mockImplementation(() =>
      chatEventsFor(JSON.stringify({ steps: ['1', '2', '3', '4', '5', '6', '7', '8'] })),
    );

    const plan = await service.createPlan({
      agent,
      objective: 'Do many things.',
      allowedToolNames: [],
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
    });

    expect(plan.steps.length).toBeLessThanOrEqual(6);
  });

  it('falls back to a single-step plan when the model output is not valid JSON', async () => {
    aiGatewayService.streamChat.mockImplementation(() => chatEventsFor('not json at all'));

    const plan = await service.createPlan({
      agent,
      objective: 'Find the time.',
      allowedToolNames: [],
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
    });

    expect(plan.objective).toBe('Find the time.');
    expect(plan.steps).toHaveLength(1);
  });

  it('falls back to a single-step plan when the planning call itself fails', async () => {
    aiGatewayService.streamChat.mockImplementation(() => {
      throw new Error('provider unavailable');
    });

    const plan = await service.createPlan({
      agent,
      objective: 'Find the time.',
      allowedToolNames: [],
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
    });

    expect(plan.steps).toHaveLength(1);
  });

  it('only describes tools the agent is allowed to use in the prompt', async () => {
    aiGatewayService.streamChat.mockImplementation(() =>
      chatEventsFor(JSON.stringify({ steps: ['ok'] })),
    );

    await service.createPlan({
      agent,
      objective: 'Do the math.',
      allowedToolNames: ['calculator'],
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
    });

    expect(toolRegistry.list).toHaveBeenCalled();
    const [[call]] = aiGatewayService.streamChat.mock.calls;
    expect(call.systemPrompt).toContain('calculator');
    expect(call.systemPrompt).not.toContain('datetime');
  });
});
