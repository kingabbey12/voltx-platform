import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AgentApprovalService } from '../src/modules/ai/approvals/agent-approval.service';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { AiRateLimiterService } from '../src/modules/ai/gateway/ai-rate-limiter.service';
import { AiToolPermissionService } from '../src/modules/ai/gateway/ai-tool-permission.service';
import { AiUsageService } from '../src/modules/ai/gateway/ai-usage.service';
import { KnowledgeRetrieverService } from '../src/modules/ai/gateway/knowledge-retriever.service';
import { UsageMeteringService } from '../src/modules/billing/usage-metering.service';
import { AIStreamEvent } from '../src/modules/ai/models/ai-model.types';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

describe('AIGatewayService', () => {
  let service: AIGatewayService;
  let aiRuntimeService: jest.Mocked<AIRuntimeService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let auditService: jest.Mocked<AuditService>;
  let usageService: jest.Mocked<AiUsageService>;
  let usageMeteringService: jest.Mocked<UsageMeteringService>;
  let rateLimiterService: jest.Mocked<AiRateLimiterService>;
  let toolPermissionService: jest.Mocked<AiToolPermissionService>;
  let knowledgeRetrieverService: jest.Mocked<KnowledgeRetrieverService>;
  let agentApprovalService: jest.Mocked<AgentApprovalService>;

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
          provide: UsageMeteringService,
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
        {
          provide: AgentApprovalService,
          useValue: {
            findOrCreatePending: jest.fn(),
          },
        },
        {
          provide: ToolRegistry,
          useValue: {
            get: jest.fn().mockImplementation((name: string) => ({
              name,
              description: 'test tool',
              inputSchema: { type: 'object', properties: {} },
              execute: () => Promise.resolve(undefined),
            })),
          },
        },
      ],
    }).compile();

    service = module.get(AIGatewayService);
    aiRuntimeService = module.get(AIRuntimeService);
    tenantContextService = module.get(TenantContextService);
    auditService = module.get(AuditService);
    usageService = module.get(AiUsageService);
    usageMeteringService = module.get(UsageMeteringService);
    rateLimiterService = module.get(AiRateLimiterService);
    toolPermissionService = module.get(AiToolPermissionService);
    knowledgeRetrieverService = module.get(KnowledgeRetrieverService);
    agentApprovalService = module.get(AgentApprovalService);
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
      // streamChat's telemetry (usage + usage-metering + audit) fires from
      // an un-awaited `finally` block by design, so it can never add
      // latency to the stream's own completion — flush the event loop
      // once so those fire-and-forget calls have actually landed before
      // asserting on them below.
      await new Promise((resolve) => setImmediate(resolve));

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
      expect(usageMeteringService.record).toHaveBeenCalledWith('org-1', 'ai_requests', 1);
      expect(usageMeteringService.record).toHaveBeenCalledWith('org-1', 'ai_tokens', 15);
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
      expect(usageMeteringService.record).not.toHaveBeenCalled();
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
        grounding: null,
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

    it('pauses on a mutating tool call within an agent run instead of executing it', async () => {
      agentApprovalService.findOrCreatePending.mockResolvedValue({
        id: 'approval-1',
        organizationId: 'org-1',
        agentRunId: 'run-1',
        toolName: 'create_task',
        input: { subject: 'Follow up' },
        status: 'PENDING',
        approverUserId: null,
        comment: null,
        expiresAt: null,
        decidedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.executeTool(
          {
            conversationId: 'conversation-1',
            toolName: 'create_task',
            input: { subject: 'Follow up' },
          },
          {
            agentId: 'agent-1',
            agentRunId: 'run-1',
            grantedPermissions: ['sales.activity.create'],
          },
        ),
      ).rejects.toThrow(/requires approval/);

      expect(agentApprovalService.findOrCreatePending).toHaveBeenCalledWith(
        'run-1',
        'create_task',
        { subject: 'Follow up' },
      );
      expect(aiRuntimeService.executeTool).not.toHaveBeenCalled();
    });

    it('does not gate a tool call with no agentRunId (a direct, non-agent-run request)', async () => {
      aiRuntimeService.executeTool.mockResolvedValue({
        execution: {
          id: 'execution-2',
          conversationId: 'conversation-1',
          toolName: 'create_task',
          input: {},
          output: {},
          status: 'SUCCEEDED',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5,
          error: null,
          createdAt: new Date(),
        },
        result: { toolName: 'create_task', content: '{}' },
        grounding: null,
        message: {
          id: 'message-2',
          conversationId: 'conversation-1',
          role: 'tool',
          content: '{}',
          metadata: {},
          tokenUsage: {},
          createdAt: new Date().toISOString(),
        },
      });

      await service.executeTool({
        conversationId: 'conversation-1',
        toolName: 'create_task',
        input: {},
      });

      expect(agentApprovalService.findOrCreatePending).not.toHaveBeenCalled();
      expect(aiRuntimeService.executeTool).toHaveBeenCalled();
    });

    it('bypasses the approval gate when skipApprovalCheck is set (resuming an approved action)', async () => {
      aiRuntimeService.executeTool.mockResolvedValue({
        execution: {
          id: 'execution-3',
          conversationId: 'conversation-1',
          toolName: 'create_task',
          input: {},
          output: {},
          status: 'SUCCEEDED',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5,
          error: null,
          createdAt: new Date(),
        },
        result: { toolName: 'create_task', content: '{}' },
        grounding: null,
        message: {
          id: 'message-3',
          conversationId: 'conversation-1',
          role: 'tool',
          content: '{}',
          metadata: {},
          tokenUsage: {},
          createdAt: new Date().toISOString(),
        },
      });

      await service.executeTool(
        { conversationId: 'conversation-1', toolName: 'create_task', input: {} },
        { agentId: 'agent-1', agentRunId: 'run-1', skipApprovalCheck: true },
      );

      expect(agentApprovalService.findOrCreatePending).not.toHaveBeenCalled();
      expect(aiRuntimeService.executeTool).toHaveBeenCalled();
    });
  });
});
