import { NotFoundException } from '@nestjs/common';
import { WorkflowAiService } from '../src/modules/workflows/ai/workflow-ai.service';

describe('WorkflowAiService', () => {
  let agentService: { findAgentByName: jest.Mock; runAgent: jest.Mock };
  let aiConversationService: { createConversation: jest.Mock };
  let workflowService: {
    getWorkflowOrThrow: jest.Mock;
    listVersions: jest.Mock;
    listRuns: jest.Mock;
  };
  let workflowDefinitionValidatorService: { validate: jest.Mock };
  let service: WorkflowAiService;

  function mockAssistantReply(content: string) {
    agentService.runAgent.mockResolvedValueOnce({ assistantMessage: { content } });
  }

  beforeEach(() => {
    agentService = { findAgentByName: jest.fn(), runAgent: jest.fn() };
    aiConversationService = { createConversation: jest.fn() };
    workflowService = {
      getWorkflowOrThrow: jest.fn(),
      listVersions: jest.fn(),
      listRuns: jest.fn(),
    };
    workflowDefinitionValidatorService = { validate: jest.fn() };

    agentService.findAgentByName.mockResolvedValue({
      id: 'agent-1',
      provider: 'anthropic',
      model: 'claude-1',
    });
    aiConversationService.createConversation.mockResolvedValue({ id: 'conversation-1' });

    service = new WorkflowAiService(
      agentService as never,
      aiConversationService as never,
      workflowService as never,
      workflowDefinitionValidatorService as never,
    );
  });

  describe('generateWorkflowDefinition', () => {
    it('returns the parsed definition when the first attempt validates', async () => {
      mockAssistantReply(
        '{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{"delayMs":1000}}]}',
      );

      const definition = await service.generateWorkflowDefinition('wait a bit');

      expect(definition.steps).toHaveLength(1);
      expect(workflowDefinitionValidatorService.validate).toHaveBeenCalledTimes(1);
      expect(agentService.runAgent).toHaveBeenCalledTimes(1);
    });

    it('strips markdown code fences before parsing', async () => {
      mockAssistantReply(
        '```json\n{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{"delayMs":1000}}]}\n```',
      );

      const definition = await service.generateWorkflowDefinition('wait a bit');

      expect(definition.steps).toHaveLength(1);
    });

    it('retries once with the validation error fed back, and returns the corrected definition', async () => {
      mockAssistantReply('{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{}}]}');
      mockAssistantReply(
        '{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{"delayMs":1000}}]}',
      );
      workflowDefinitionValidatorService.validate
        .mockImplementationOnce(() => {
          throw new Error('DELAY step "s1" requires config.delayMs');
        })
        .mockImplementationOnce(() => undefined);

      const definition = await service.generateWorkflowDefinition('wait a bit');

      expect(definition.steps[0]?.config).toEqual({ delayMs: 1000 });
      expect(agentService.runAgent).toHaveBeenCalledTimes(2);
      const [, secondCallArgs] = agentService.runAgent.mock.calls[1] as [
        string,
        { prompt: string },
      ];
      const secondPrompt = secondCallArgs.prompt;
      expect(secondPrompt).toContain('DELAY step "s1" requires config.delayMs');
      expect(workflowDefinitionValidatorService.validate).toHaveBeenCalledTimes(2);
    });

    it('propagates a second validation failure rather than retrying indefinitely', async () => {
      mockAssistantReply('{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{}}]}');
      mockAssistantReply('{"steps":[{"id":"s1","name":"Step","type":"DELAY","config":{}}]}');
      workflowDefinitionValidatorService.validate.mockImplementation(() => {
        throw new Error('DELAY step "s1" requires config.delayMs');
      });

      await expect(service.generateWorkflowDefinition('wait a bit')).rejects.toThrow(
        'DELAY step "s1" requires config.delayMs',
      );
      expect(agentService.runAgent).toHaveBeenCalledTimes(2);
    });

    it('throws when the model does not return valid JSON', async () => {
      mockAssistantReply('sure, here is a workflow for you...');

      await expect(service.generateWorkflowDefinition('wait a bit')).rejects.toThrow(
        /did not return valid JSON/,
      );
      expect(workflowDefinitionValidatorService.validate).not.toHaveBeenCalled();
    });

    it('throws when the "Workflow Assistant" agent does not exist', async () => {
      agentService.findAgentByName.mockResolvedValue(null);

      await expect(service.generateWorkflowDefinition('wait a bit')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('explainWorkflow', () => {
    it('gathers workflow metadata and definition into the prompt', async () => {
      workflowService.getWorkflowOrThrow.mockResolvedValue({
        id: 'wf-1',
        name: 'Lead follow-up',
        description: 'Follows up on new leads',
        status: 'PUBLISHED',
      });
      workflowService.listVersions.mockResolvedValue([
        {
          version: 1,
          definition: { steps: [{ id: 's1', name: 'Step', type: 'DELAY', config: {} }] },
        },
      ]);
      mockAssistantReply('This workflow waits, then does nothing else.');

      const explanation = await service.explainWorkflow('wf-1');

      expect(explanation).toBe('This workflow waits, then does nothing else.');
      const [, callArgs] = agentService.runAgent.mock.calls[0] as [string, { prompt: string }];
      const prompt = callArgs.prompt;
      expect(prompt).toContain('Lead follow-up');
      expect(prompt).toContain('Follows up on new leads');
      expect(workflowService.listRuns).not.toHaveBeenCalled();
    });
  });

  describe('debugWorkflow', () => {
    it('includes recent run statuses and errors in the prompt', async () => {
      workflowService.getWorkflowOrThrow.mockResolvedValue({
        id: 'wf-1',
        name: 'Lead follow-up',
        description: null,
        status: 'PUBLISHED',
      });
      workflowService.listVersions.mockResolvedValue([{ version: 1, definition: { steps: [] } }]);
      workflowService.listRuns.mockResolvedValue({
        items: [
          {
            status: 'FAILED',
            error: 'Tool "search_crm" not found',
            startedAt: new Date('2026-01-01T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
      mockAssistantReply('The failure is because step s1 calls an unregistered tool.');

      const diagnosis = await service.debugWorkflow('wf-1');

      expect(diagnosis).toContain('unregistered tool');
      const [, callArgs] = agentService.runAgent.mock.calls[0] as [string, { prompt: string }];
      const prompt = callArgs.prompt;
      expect(prompt).toContain('Tool "search_crm" not found');
      expect(prompt).toContain('FAILED');
    });
  });
});
