import { ServiceUnavailableException } from '@nestjs/common';
import { AutonomousWorkflowPlansService } from '../src/modules/ai/workflow-engine/workflow-engine.service';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { AssistantService } from '../src/modules/ai/assistant/assistant.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveDecisionsService } from '../src/modules/ai/decision/decision.service';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { OrchestratorService } from '../src/modules/ai/orchestrator/orchestrator.service';

describe('AssistantService', () => {
  let agentService: jest.Mocked<Pick<AgentService, 'findAgentByName'>>;
  let conversationService: jest.Mocked<Pick<ConversationService, 'createConversation'>>;
  let contextService: jest.Mocked<Pick<ExecutiveContextService, 'getExecutiveContext'>>;
  let service: AssistantService;

  beforeEach(() => {
    agentService = { findAgentByName: jest.fn() };
    conversationService = { createConversation: jest.fn() };
    contextService = { getExecutiveContext: jest.fn() };
    service = new AssistantService(
      agentService as unknown as AgentService,
      conversationService as unknown as ConversationService,
      contextService as unknown as ExecutiveContextService,
      { generate: jest.fn() } as unknown as ExecutiveInsightsService,
      { generateFromContext: jest.fn().mockResolvedValue({}) } as never,
      { generateFrom: jest.fn() } as unknown as ExecutiveDecisionsService,
      {
        orchestrateFrom: jest.fn().mockResolvedValue({
          orchestrationVersion: '1.0',
          agents: [],
          recommendations: [],
          conflicts: [],
          consensus: { agreementScore: 1 },
        }),
      } as unknown as OrchestratorService,
      {
        generateForAssistant: jest.fn().mockResolvedValue({ plans: [], plansGenerated: 0 }),
      } as unknown as AutonomousWorkflowPlansService,
    );
  });

  it('starts a normal conversation for the existing Executive Assistant', async () => {
    agentService.findAgentByName.mockResolvedValue({ id: 'assistant-agent-id' } as never);
    conversationService.createConversation.mockResolvedValue({ id: 'conversation-id' } as never);

    const result = await service.createSession();

    expect(result.conversationId).toBe('conversation-id');
    expect(result.agentId).toBe('assistant-agent-id');
    expect(result.suggestedPrompts).toEqual(
      expect.arrayContaining([
        'What should I do today?',
        'What is my highest priority?',
        'What should I review first?',
        'What business risk needs attention?',
        'Summarize the current state of the business.',
      ]),
    );
    expect(agentService.findAgentByName).toHaveBeenCalledWith('Executive Assistant');
    expect(conversationService.createConversation).toHaveBeenCalledWith({
      title: 'Executive Assistant',
    });
  });

  it('does not create a conversation when no AI provider can provision the assistant', async () => {
    agentService.findAgentByName.mockResolvedValue(null);

    await expect(service.createSession()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(conversationService.createConversation).not.toHaveBeenCalled();
  });
});
