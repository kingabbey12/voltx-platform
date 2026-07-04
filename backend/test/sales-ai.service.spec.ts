import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { SalesAiService } from '../src/modules/sales/sales-ai.service';

describe('SalesAiService', () => {
  let service: SalesAiService;
  let agentService: jest.Mocked<AgentService>;
  let conversationService: jest.Mocked<ConversationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesAiService,
        {
          provide: AgentService,
          useValue: {
            findAgentByName: jest.fn(),
            runAgent: jest.fn(),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            createConversation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SalesAiService);
    agentService = module.get(AgentService);
    conversationService = module.get(ConversationService);
  });

  it('creates a conversation and runs the Sales Assistant agent', async () => {
    agentService.findAgentByName.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Sales Assistant',
      description: 'Built-in sales assistant',
      systemPrompt: 'You are a sales assistant.',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: {},
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    conversationService.createConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Lead qualification',
      provider: 'openai',
      model: 'gpt-5-mini',
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    agentService.runAgent.mockResolvedValue({
      run: {
        id: 'run-1',
      } as never,
      assistantMessage: {
        id: 'message-1',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'High-fit lead with buying urgency.',
        metadata: {},
        tokenUsage: {},
        createdAt: new Date().toISOString(),
      },
      toolMessages: [],
    } as never);

    const result = await service.run(
      {
        title: 'Lead qualification',
        prompt: 'Assess this lead.',
        workspaceContext: ['Lead title: Acme'],
        action: 'lead_qualification',
      },
      {
        prompt: 'Focus on urgency.',
        workspaceContext: ['Segment: Enterprise'],
      },
    );

    expect(conversationService.createConversation).toHaveBeenCalledWith({
      title: 'Lead qualification',
      provider: 'openai',
      model: 'gpt-5-mini',
    });
    expect(agentService.runAgent).toHaveBeenCalledWith('agent-1', {
      conversationId: 'conversation-1',
      prompt: 'Focus on urgency.',
      workspaceContext: ['Lead title: Acme', 'Segment: Enterprise'],
      toolRequests: [
        {
          toolName: 'datetime',
          input: {
            timezone: 'UTC',
          },
        },
      ],
    });
    expect(result.outputText).toBe('High-fit lead with buying urgency.');
    expect(result.conversationId).toBe('conversation-1');
    expect(result.agentRunId).toBe('run-1');
  });

  it('throws when the Sales Assistant agent is unavailable', async () => {
    agentService.findAgentByName.mockResolvedValue(null);

    await expect(
      service.run({
        title: 'Unavailable',
        prompt: 'Prompt',
        workspaceContext: [],
        action: 'test',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
