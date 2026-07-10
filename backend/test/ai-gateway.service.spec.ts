import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { AiRateLimiterService } from '../src/modules/ai/gateway/ai-rate-limiter.service';
import { AiToolPermissionService } from '../src/modules/ai/gateway/ai-tool-permission.service';
import { AiUsageService } from '../src/modules/ai/gateway/ai-usage.service';
import { KnowledgeRetrieverService } from '../src/modules/ai/gateway/knowledge-retriever.service';
import { AIStreamEvent } from '../src/modules/ai/models/ai-model.types';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';

describe('AIGatewayService', () => {
  let service: AIGatewayService;
  let aiRuntimeService: jest.Mocked<AIRuntimeService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let auditService: jest.Mocked<AuditService>;
  let usageService: jest.Mocked<AiUsageService>;
  let rateLimiterService: jest.Mocked<AiRateLimiterService>;
  let toolPermissionService: jest.Mocked<AiToolPermissionService>;
  let knowledgeRetrieverService: jest.Mocked<KnowledgeRetrieverService>;

  const tenant = {
    organizationId: 'org-1',
    userId: 'user-1',
    membershipId: 'membership-1',
    requestId: 'request-1',
  };

  async function collect(stream: AsyncIterable<AIStreamEvent>): Promise<AIStreamEvent[]> {
    const events: AIStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    return events;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGatewayService,
        {
          provide: AIRuntimeService,
          useValue: {
            streamChat: jest.fn(),
            executeTool: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(tenant),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiUsageService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiRateLimiterService,
          useValue: {
            assertWithinLimit: jest.fn(),
          },
        },
        {
          provide: AiToolPermissionService,
          useValue: {
            assertPermitted: jest.fn(),
          },
        },
        {
          provide: KnowledgeRetrieverService,
          useValue: {
            retrieve: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(AIGatewayService);
    aiRuntimeService = module.get(AIRuntimeService);
    tenantContextService = module.get(TenantContextService);
    auditService = module.get(AuditService);
    usageService = module.get(AiUsageService);
    rateLimiterService = module.get(AiRateLimiterService);
    toolPermissionService = module.get(AiToolPermissionService);
    knowledgeRetrieverService = module.get(KnowledgeRetrieverService);
  });

  describe('streamChat', () => {
    it('asserts tenant context and rate limit, merges knowledge context, and passes events through unchanged', async () => {
      knowledgeRetrieverService.retrieve.mockResolvedValue(['Known fact: Voltx is a CRM.']);
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield {
          type: 'content_delta',
          provider: 'openai',
          model: 'gpt-5-mini',
          delta: 'Hello',
        };
        yield {
          type: 'message_end',
          provider: 'openai',
          model: 'gpt-5-mini',
          finishReason: 'stop',
          outputText: 'Hello',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      });

      const events = await collect(
        service.streamChat({
          requestType: 'CHAT',
          conversationId: 'conversation-1',
          userPrompt: 'Hi there',
          workspaceContext: ['Existing context'],
        }),
      );

      expect(tenantContextService.getOrThrow).toHaveBeenCalled();
      expect(rateLimiterService.assertWithinLimit).toHaveBeenCalledWith('org-1');
      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({ type: 'message_end', outputText: 'Hello' });

      expect(aiRuntimeService.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceContext: ['Existing context', 'Known fact: Voltx is a CRM.'],
        }),
      );

      expect(usageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          conversationId: 'conversation-1',
          requestType: 'CHAT',
          provider: 'openai',
          model: 'gpt-5-mini',
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          succeeded: true,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat', resource: 'ai_gateway_request' }),
      );
    });

    it('propagates rate limit failures without calling the runtime', async () => {
      rateLimiterService.assertWithinLimit.mockImplementation(() => {
        throw new Error('rate limit exceeded');
      });

      await expect(
        collect(service.streamChat({ requestType: 'CHAT', userPrompt: 'Hi' })),
      ).rejects.toThrow('rate limit exceeded');

      expect(aiRuntimeService.streamChat).not.toHaveBeenCalled();
    });

    it('records failure telemetry and rethrows when the runtime stream fails', async () => {
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield {
          type: 'content_delta',
          provider: 'openai',
          model: 'gpt-5-mini',
          delta: 'partial',
        };
        throw new Error('provider unavailable');
      });

      await expect(
        collect(service.streamChat({ requestType: 'CHAT', userPrompt: 'Hi' })),
      ).rejects.toThrow('provider unavailable');

      expect(usageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ succeeded: false, errorMessage: 'provider unavailable' }),
      );
    });

    it('defaults maxOutputTokens to 2048 for CHAT/CONVERSATION_MESSAGE when the caller passes none', async () => {
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield { type: 'message_end', provider: 'openai', model: 'gpt-5-mini', outputText: 'Hi' };
      });

      await collect(service.streamChat({ requestType: 'CHAT', userPrompt: 'Hi' }));
      expect(aiRuntimeService.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 2048 }),
      );

      await collect(service.streamChat({ requestType: 'CONVERSATION_MESSAGE', userPrompt: 'Hi' }));
      expect(aiRuntimeService.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 2048 }),
      );
    });

    it('defaults maxOutputTokens to 2000 for AGENT_RUN when the caller passes none', async () => {
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield { type: 'message_end', provider: 'openai', model: 'gpt-5-mini', outputText: 'Hi' };
      });

      await collect(service.streamChat({ requestType: 'AGENT_RUN', userPrompt: 'Go' }));
      expect(aiRuntimeService.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 2000 }),
      );
    });

    it('never overrides an explicit maxOutputTokens passed by the caller', async () => {
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield { type: 'message_end', provider: 'openai', model: 'gpt-5-mini', outputText: 'Hi' };
      });

      await collect(
        service.streamChat({ requestType: 'AGENT_RUN', userPrompt: 'Go', maxOutputTokens: 1500 }),
      );
      expect(aiRuntimeService.streamChat).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 1500 }),
      );
    });

    it('never lets a telemetry failure surface as a stream failure', async () => {
      usageService.record.mockRejectedValue(new Error('db unavailable'));
      aiRuntimeService.streamChat.mockImplementation(async function* stream() {
        await Promise.resolve();
        yield {
          type: 'message_end',
          provider: 'openai',
          model: 'gpt-5-mini',
          outputText: 'Done',
        };
      });

      await expect(
        collect(service.streamChat({ requestType: 'CHAT', userPrompt: 'Hi' })),
      ).resolves.toHaveLength(1);
    });
  });

  describe('executeTool', () => {
    it('checks tool permission before delegating to the runtime and records usage', async () => {
      aiRuntimeService.executeTool.mockResolvedValue({
        execution: {
          id: 'execution-1',
          conversationId: 'conversation-1',
          toolName: 'datetime',
          input: {},
          output: {},
          status: 'SUCCEEDED',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5,
          error: null,
          createdAt: new Date(),
        },
        result: { toolName: 'datetime', content: '{}' },
        message: {
          id: 'message-1',
          conversationId: 'conversation-1',
          role: 'tool',
          content: '{}',
          metadata: {},
          tokenUsage: {},
          createdAt: new Date().toISOString(),
        },
      });

      const response = await service.executeTool(
        { conversationId: 'conversation-1', toolName: 'datetime', input: {} },
        { agentId: 'agent-1', agentRunId: 'run-1', grantedPermissions: [] },
      );

      expect(toolPermissionService.assertPermitted).toHaveBeenCalledWith('datetime', []);
      expect(aiRuntimeService.executeTool).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'datetime' }),
      );
      expect(response.result.toolName).toBe('datetime');
      expect(usageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'TOOL_EXECUTION',
          toolName: 'datetime',
          agentId: 'agent-1',
          agentRunId: 'run-1',
          succeeded: true,
        }),
      );
    });

    it('never calls the runtime when the tool permission check fails', async () => {
      toolPermissionService.assertPermitted.mockImplementation(() => {
        throw new Error('missing permission');
      });

      await expect(
        service.executeTool({
          conversationId: 'conversation-1',
          toolName: 'restricted',
          input: {},
        }),
      ).rejects.toThrow('missing permission');

      expect(aiRuntimeService.executeTool).not.toHaveBeenCalled();
    });
  });
});
