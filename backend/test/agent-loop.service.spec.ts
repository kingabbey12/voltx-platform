import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentFactory } from '../src/modules/ai/agents/agent.factory';
import { AgentRepository } from '../src/modules/ai/agents/agent.repository';
import { AgentLoopService } from '../src/modules/ai/agents/autonomous/agent-loop.service';
import { AgentPlannerService } from '../src/modules/ai/agents/autonomous/agent-planner.service';
import { AgentRunStepRepository } from '../src/modules/ai/agents/autonomous/agent-run-step.repository';
import { createCoordinationState } from '../src/modules/ai/agents/autonomous/coordination-state';
import { MultiAgentOrchestratorService } from '../src/modules/ai/agents/autonomous/multi-agent-orchestrator.service';
import { MultiAgentStreamEvent } from '../src/modules/ai/agents/autonomous/multi-agent-stream-event.types';
import { AgentEntity } from '../src/modules/ai/agents/entities/agent.entity';
import { AgentRunEntity } from '../src/modules/ai/agents/entities/agent-run.entity';
import { ConversationRepository } from '../src/modules/ai/conversations/conversation.repository';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { AiGatewayStreamEvent } from '../src/modules/ai/gateway/ai-gateway-stream-event.types';
import { MemoryService } from '../src/modules/ai/memory/memory.service';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

type StreamableEvent = AiGatewayStreamEvent | MultiAgentStreamEvent;

describe('AgentLoopService', () => {
  let service: AgentLoopService;
  let aiGatewayService: jest.Mocked<AIGatewayService>;
  let agentPlannerService: jest.Mocked<AgentPlannerService>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let memoryService: jest.Mocked<MemoryService>;
  let agentFactory: jest.Mocked<AgentFactory>;
  let agentRepository: jest.Mocked<AgentRepository>;
  let multiAgentOrchestratorService: jest.Mocked<MultiAgentOrchestratorService>;

  const agent: AgentEntity = {
    id: 'agent-1',
    organizationId: 'org-1',
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a test agent.',
    provider: 'openai',
    model: 'gpt-5-mini',
    configuration: { toolNames: [] },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const agentRun: AgentRunEntity = {
    id: 'run-1',
    agentId: 'agent-1',
    conversationId: 'conversation-1',
    parentRunId: null,
    rootRunId: null,
    depth: 0,
    status: 'RUNNING',
    input: {},
    output: {},
    currentStep: 0,
    iterationCount: 0,
    toolCallCount: 0,
    startedAt: new Date(),
    completedAt: null,
    durationMs: null,
    tokenUsage: {},
    error: null,
    createdAt: new Date(),
  };

  function messageEntity(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'message-1',
      conversationId: 'conversation-1',
      role: 'USER',
      content: 'objective',
      metadata: {},
      tokenUsage: {},
      createdAt: new Date(),
      ...overrides,
    };
  }

  function chatEventsFor(text: string) {
    return (async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta' as const,
        provider: 'openai' as const,
        model: 'gpt-5-mini',
        delta: text,
      };
      yield {
        type: 'message_end' as const,
        provider: 'openai' as const,
        model: 'gpt-5-mini',
        outputText: text,
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      };
    })();
  }

  // eslint-disable-next-line require-yield -- yield-less by design: satisfies AsyncGenerator-typed mocks that never actually stream events.
  async function* generatorReturning<T>(value: T): AsyncGenerator<never, T> {
    await Promise.resolve();
    return value;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentLoopService,
        {
          provide: AIGatewayService,
          useValue: {
            streamChat: jest.fn(),
            executeTool: jest.fn(),
          },
        },
        {
          provide: AgentPlannerService,
          useValue: {
            createPlan: jest.fn().mockResolvedValue({
              objective: 'Find the time and report it.',
              steps: ['Check the current time', 'Report it back'],
            }),
          },
        },
        {
          provide: ConversationRepository,
          useValue: {
            createMessage: jest
              .fn()
              .mockImplementation((data: Record<string, unknown>) =>
                Promise.resolve(messageEntity({ role: data.role, content: data.content })),
              ),
            findAllMessagesForConversation: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            captureConversationMemories: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AgentFactory,
          useValue: {
            getAllowedToolNames: jest.fn().mockReturnValue([]),
            canDelegate: jest.fn().mockReturnValue(true),
            getAllowedDelegateAgentNames: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: ToolRegistry,
          useValue: {
            list: jest.fn().mockReturnValue([
              {
                name: 'datetime',
                description: 'Return the current time',
                inputSchema: { type: 'object', properties: {} },
              },
            ]),
          },
        },
        {
          provide: AgentRunStepRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AgentRepository,
          useValue: {
            updateAgentRunProgress: jest.fn().mockResolvedValue(undefined),
            listAgents: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MultiAgentOrchestratorService,
          useValue: {
            delegate: jest.fn(),
            delegateParallel: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue: number) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get(AgentLoopService);
    aiGatewayService = module.get(AIGatewayService);
    agentPlannerService = module.get(AgentPlannerService);
    conversationRepository = module.get(ConversationRepository);
    memoryService = module.get(MemoryService);
    agentFactory = module.get(AgentFactory);
    agentRepository = module.get(AgentRepository);
    multiAgentOrchestratorService = module.get(MultiAgentOrchestratorService);
  });

  async function drain(
    generator: AsyncGenerator<StreamableEvent, unknown>,
  ): Promise<{ events: StreamableEvent[]; result: unknown }> {
    const events: StreamableEvent[] = [];
    let step = await generator.next();
    while (!step.done) {
      events.push(step.value);
      step = await generator.next();
    }
    return { events, result: step.value };
  }

  it('executes a multi-step run: reasons, calls a tool, observes, then finalizes', async () => {
    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            thought: 'need time',
            toolName: 'datetime',
            input: {},
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'The time is noon.' })),
      );

    aiGatewayService.executeTool.mockResolvedValue({
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
      result: { toolName: 'datetime', content: '{"iso":"noon"}' },
      message: messageEntity({ role: 'tool', content: '{"iso":"noon"}' }) as never,
    });

    const { events, result } = await drain(
      service.run(agent, agentRun, { objective: 'Find the time and report it.' }, []),
    );

    expect(aiGatewayService.streamChat).toHaveBeenCalledTimes(2);
    expect(events.some((event) => event.type === 'plan')).toBe(true);
    expect(events.some((event) => event.type === 'tool_call_start')).toBe(true);
    expect(events.some((event) => event.type === 'tool_call_result')).toBe(true);
    expect(
      events.some((event) => event.type === 'decision' && event.decision === 'final_answer'),
    ).toBe(true);

    expect(result).toMatchObject({
      outputText: 'The time is noon.',
      iterations: 2,
      toolCallCount: 1,
      stoppedReason: 'final_answer',
    });
    expect(memoryService.captureConversationMemories).toHaveBeenCalled();
  });

  it('recovers from a tool failure and still reaches a final answer', async () => {
    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({ action: 'tool_call', toolName: 'datetime', input: {}, thought: 'try' }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Could not get the time.' }),
        ),
      );

    aiGatewayService.executeTool.mockRejectedValue(new Error('tool exploded'));

    const { events, result } = await drain(
      service.run(agent, agentRun, { objective: 'Find the time.' }, []),
    );

    expect(events.some((event) => event.type === 'tool_call_error')).toBe(true);
    expect(result).toMatchObject({
      outputText: 'Could not get the time.',
      toolCallCount: 1,
      stoppedReason: 'final_answer',
    });
  });

  it('stops at the max iteration limit and recovers via a forced final answer', async () => {
    // Every reasoning call requests another tool call, so the loop never
    // finalizes on its own and must be cut off by maxIterations.
    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'tool_call', toolName: 'datetime', input: {} })),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'tool_call', toolName: 'datetime', input: {} })),
      )
      .mockImplementationOnce(() => chatEventsFor('Best effort answer given the time budget.'));

    aiGatewayService.executeTool.mockResolvedValue({
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
      result: { toolName: 'datetime', content: '{"iso":"noon"}' },
      message: messageEntity({ role: 'tool', content: '{"iso":"noon"}' }) as never,
    });

    const { result } = await drain(
      service.run(agent, agentRun, { objective: 'Loop forever.', maxIterations: 2 }, []),
    );

    expect(result).toMatchObject({
      iterations: 2,
      stoppedReason: 'max_iterations',
      outputText: 'Best effort answer given the time budget.',
    });
  });

  it('propagates cancellation instead of attempting a forced final answer', async () => {
    const controller = new AbortController();

    aiGatewayService.streamChat.mockImplementationOnce(() =>
      (async function* stream() {
        controller.abort();
        await Promise.resolve();
        yield {
          type: 'content_delta' as const,
          provider: 'openai' as const,
          model: 'gpt-5-mini',
          delta: 'partial',
        };
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      })(),
    );

    await expect(
      drain(service.run(agent, agentRun, { objective: 'Cancel me.' }, [], controller.signal)),
    ).rejects.toThrow('The operation was aborted');
  });

  it('passes the conversationId to every reasoning call so memory retrieval is exercised each iteration', async () => {
    aiGatewayService.streamChat.mockImplementationOnce(() =>
      chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Done.' })),
    );

    await drain(service.run(agent, agentRun, { objective: 'Simple objective.' }, []));

    for (const call of aiGatewayService.streamChat.mock.calls) {
      expect(call[0].conversationId).toBe('conversation-1');
    }
    expect(conversationRepository.findAllMessagesForConversation).toHaveBeenCalledWith(
      'conversation-1',
    );
    expect(agentFactory.getAllowedToolNames).toHaveBeenCalledWith(agent);
    expect(agentPlannerService.createPlan).toHaveBeenCalled();
    expect(agentRepository.updateAgentRunProgress).toHaveBeenCalled();
  });

  it('delegates to another agent when a coordination state is present, then finishes', async () => {
    agentRepository.listAgents.mockResolvedValue([
      { ...agent, id: 'agent-2', name: 'Sales Assistant' },
    ]);
    multiAgentOrchestratorService.delegate.mockReturnValue(
      generatorReturning({
        agentName: 'Sales Assistant',
        succeeded: true,
        resultText: 'Pipeline summary ready.',
      }),
    );

    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'delegate',
            thought: 'need sales input',
            agentName: 'Sales Assistant',
            objective: 'Summarize the pipeline.',
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Pipeline summary ready.' }),
        ),
      );

    const coordinationState = createCoordinationState('run-1', {
      maxAgents: 5,
      maxDepth: 2,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    const { events, result } = await drain(
      service.run(
        agent,
        agentRun,
        { objective: 'Prepare an executive summary.', coordinationState },
        [],
      ),
    );

    expect(multiAgentOrchestratorService.delegate).toHaveBeenCalledWith(
      agent,
      agentRun,
      { agentName: 'Sales Assistant', objective: 'Summarize the pipeline.' },
      1,
      coordinationState,
      [],
      expect.anything(),
    );
    expect(events.some((event) => event.type === 'decision' && event.decision === 'delegate')).toBe(
      true,
    );
    expect(result).toMatchObject({
      outputText: 'Pipeline summary ready.',
      stoppedReason: 'final_answer',
    });
  });

  it('delegates to multiple agents in parallel via delegate_parallel', async () => {
    agentRepository.listAgents.mockResolvedValue([
      { ...agent, id: 'agent-2', name: 'Sales Assistant' },
      { ...agent, id: 'agent-3', name: 'Customer Support' },
    ]);
    multiAgentOrchestratorService.delegateParallel.mockReturnValue(
      generatorReturning([
        { agentName: 'Sales Assistant', succeeded: true, resultText: 'Sales done.' },
        { agentName: 'Customer Support', succeeded: false, resultText: 'Support agent failed.' },
      ]),
    );

    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'delegate_parallel',
            thought: 'fan out',
            delegations: [
              { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
              { agentName: 'Customer Support', objective: 'Summarize tickets.' },
            ],
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Combined summary.' })),
      );

    const coordinationState = createCoordinationState('run-1', {
      maxAgents: 5,
      maxDepth: 2,
      maxParallelExecutions: 2,
      timeoutMs: 60_000,
    });

    const { result } = await drain(
      service.run(agent, agentRun, { objective: 'Prepare summaries.', coordinationState }, []),
    );

    expect(multiAgentOrchestratorService.delegateParallel).toHaveBeenCalledWith(
      agent,
      agentRun,
      [
        { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
        { agentName: 'Customer Support', objective: 'Summarize tickets.' },
      ],
      1,
      coordinationState,
      [],
      expect.anything(),
    );
    expect(result).toMatchObject({ outputText: 'Combined summary.' });
  });

  it('reports delegation as unavailable and never calls the orchestrator without a coordination state', async () => {
    aiGatewayService.streamChat
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'delegate',
            thought: 'need help',
            agentName: 'Sales Assistant',
            objective: 'Summarize pipeline.',
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Handled it myself.' })),
      );

    const { result } = await drain(
      service.run(agent, agentRun, { objective: 'Prepare a summary.' }, []),
    );

    expect(multiAgentOrchestratorService.delegate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outputText: 'Handled it myself.' });
  });
});
