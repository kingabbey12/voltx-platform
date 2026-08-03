import { AgentService } from '../src/modules/ai/agents/agent.service';
import { RunAutonomousAgentDto } from '../src/modules/ai/agents/dto/autonomous-agent.dto';
import { AssistantService } from '../src/modules/ai/assistant/assistant.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveContext } from '../src/modules/ai/context/context.types';
import { BusinessIntelligenceResult } from '../src/modules/business-intelligence/business-intelligence.types';
import { ExecutiveDecisionsService } from '../src/modules/ai/decision/decision.service';
import { ExecutiveDecisionsResult } from '../src/modules/ai/decision/decision.types';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { OrchestratorService } from '../src/modules/ai/orchestrator/orchestrator.service';
import { AutonomousWorkflowPlansService } from '../src/modules/ai/workflow-engine/workflow-engine.service';
import {
  StoredWorkflowPlan,
  WorkflowPlanStreamEvent,
  WorkflowPlansResult,
} from '../src/modules/ai/workflow-engine/workflow-engine.types';

const EMPTY_SECTION = { items: [], total: 0, summary: 'No data available.' };
const CONTEXT = {
  organization: { id: 'tenant-1' },
  user: { id: 'user-1' },
  crm: EMPTY_SECTION,
  finance: EMPTY_SECTION,
  operations: EMPTY_SECTION,
  communications: EMPTY_SECTION,
  notifications: EMPTY_SECTION,
  calendar: EMPTY_SECTION,
  metadata: {
    generatedAt: '2026-08-02T00:00:00.000Z',
    contextVersion: '1.0',
    tenantId: 'tenant-1',
    userId: 'user-1',
    sourcesIncluded: [],
    excludedSources: [],
    tokenEstimate: 8,
  },
} as unknown as ExecutiveContext;
const INSIGHTS = { insightVersion: '1.0', insights: [] } as never;
const DECISIONS = {
  decisionVersion: '1.0',
  generatedAt: '2026-08-02T00:00:00.000Z',
  tenantId: 'tenant-1',
  userId: 'user-1',
  decisions: [],
  excludedSources: [],
} as unknown as ExecutiveDecisionsResult;
const BUSINESS_INTELLIGENCE = {
  version: '1.0',
  generatedAt: '2026-08-02T00:00:00.000Z',
  tenantId: 'tenant-1',
  userId: 'user-1',
  executiveHealth: { id: 'executive_health', score: null, status: 'unavailable' },
  departments: [],
  excludedSources: [],
} as unknown as BusinessIntelligenceResult;

const PLAN: StoredWorkflowPlan = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'tenant-1',
  userId: 'user-1',
  planKey: 'key-1',
  planVersion: '1.0',
  plan: { title: 'Plan: review deals', approvalRequired: true } as never,
  status: 'awaiting_approval',
  approvalId: 'approval-1',
  workflowId: null,
  workflowExecutionId: null,
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  expiresAt: '2026-08-03T00:00:00.000Z',
  approvedAt: null,
  rejectedAt: null,
  handedOffAt: null,
};

const PLANS_RESULT: WorkflowPlansResult = {
  planSetVersion: '1.0',
  generatedAt: '2026-08-02T00:00:00.000Z',
  tenantId: 'tenant-1',
  userId: 'user-1',
  plans: [PLAN],
  excludedSources: [],
  decisionsConsidered: 1,
  plansGenerated: 1,
};

describe('Assistant workflow-plan integration', () => {
  let generateForAssistant: jest.Mock;
  let runStreamMock: jest.Mock;
  let contextMock: jest.Mock;
  let insightsMock: jest.Mock;
  let decisionsMock: jest.Mock;
  let businessIntelligenceMock: jest.Mock;
  let assistant: AssistantService;

  beforeEach(() => {
    generateForAssistant = jest.fn().mockResolvedValue(PLANS_RESULT);
    contextMock = jest.fn().mockResolvedValue(CONTEXT);
    insightsMock = jest.fn().mockResolvedValue(INSIGHTS);
    decisionsMock = jest.fn().mockResolvedValue(DECISIONS);
    businessIntelligenceMock = jest.fn().mockResolvedValue(BUSINESS_INTELLIGENCE);
    runStreamMock = jest.fn(function* () {
      yield { type: 'status', status: 'queued' };
    });

    assistant = new AssistantService(
      {
        findAgentByName: jest.fn().mockResolvedValue({ id: 'assistant-agent-id' }),
        runAutonomousAgentStream: runStreamMock,
      } as unknown as AgentService,
      {
        getConversation: jest.fn().mockResolvedValue({ id: 'conversation-id' }),
        createConversation: jest.fn().mockResolvedValue({ id: 'conversation-id' }),
      } as unknown as ConversationService,
      { getExecutiveContext: contextMock } as unknown as ExecutiveContextService,
      { generate: insightsMock } as unknown as ExecutiveInsightsService,
      { generateFromContext: businessIntelligenceMock } as never,
      { generateFrom: decisionsMock } as unknown as ExecutiveDecisionsService,
      {
        orchestrateFrom: jest.fn().mockResolvedValue({ agents: [], conflicts: [] }),
      } as unknown as OrchestratorService,
      { generateForAssistant } as unknown as AutonomousWorkflowPlansService,
    );
  });

  async function run(objective: string): Promise<string[]> {
    const stream = assistant.runStream({ conversationId: 'conversation-id', objective }, [
      'ai.agent.run',
    ]);
    for await (const _event of stream) {
      // drain
    }
    const calls = runStreamMock.mock.calls as Array<[string, RunAutonomousAgentDto]>;
    return calls[0][1].workspaceContext as string[];
  }

  function planBlock(workspaceContext: string[]): string {
    return workspaceContext.find((entry) =>
      entry.startsWith('Deterministic approval-gated workflow plans'),
    )!;
  }

  it('builds BI once from the existing context and forwards it verbatim', async () => {
    const workspaceContext = await run('Show company health');
    expect(contextMock).toHaveBeenCalledTimes(1);
    expect(businessIntelligenceMock).toHaveBeenCalledTimes(1);
    expect(businessIntelligenceMock).toHaveBeenCalledWith(CONTEXT);

    const block = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic business intelligence'),
    )!;
    expect(JSON.parse(block.slice(block.indexOf('{')))).toEqual(BUSINESS_INTELLIGENCE);
    expect(block).toContain('do not recalculate');
    expect(block).toContain('score":null');
  });

  it.each([
    "Create a plan for today's priorities.",
    "Prepare next week's sales plan.",
    'Build an executive action plan.',
    'Generate a customer recovery workflow.',
    'Prepare an operational improvement plan.',
  ])('calls the workflow engine exactly once for: %s', async (objective) => {
    await run(objective);
    expect(generateForAssistant).toHaveBeenCalledTimes(1);
  });

  it('reuses the context, insights and decisions already assembled in the turn', async () => {
    await run("Create a plan for today's priorities.");

    // Assembled once each, and handed to the engine rather than rebuilt.
    expect(contextMock).toHaveBeenCalledTimes(1);
    expect(insightsMock).toHaveBeenCalledTimes(1);
    expect(decisionsMock).toHaveBeenCalledTimes(1);
    const [context, insights, decisions] = generateForAssistant.mock.calls[0] as [
      ExecutiveContext,
      unknown,
      ExecutiveDecisionsResult,
    ];
    expect(context).toBe(CONTEXT);
    expect(insights).toBe(INSIGHTS);
    expect(decisions).toBe(DECISIONS);
  });

  it('forwards the structured plan verbatim — a wrong object fails this test', async () => {
    const block = planBlock(await run('Build an executive action plan.'));
    const payload = JSON.parse(block.slice(block.indexOf('{'))) as WorkflowPlansResult;

    expect(payload).toEqual(PLANS_RESULT);
    expect(payload.plans[0].id).toBe(PLAN.id);
    expect(payload.plans[0].plan.title).toBe('Plan: review deals');
  });

  it('fails if the workflow plan block is omitted entirely', async () => {
    const workspaceContext = await run('Build an executive action plan.');
    expect(
      workspaceContext.some((entry) =>
        entry.startsWith('Deterministic approval-gated workflow plans'),
      ),
    ).toBe(true);
  });

  it('preserves the approval identifier and awaiting status', async () => {
    const block = planBlock(await run("Prepare next week's sales plan."));
    const payload = JSON.parse(block.slice(block.indexOf('{'))) as WorkflowPlansResult;

    expect(payload.plans[0].status).toBe('awaiting_approval');
    expect(payload.plans[0].approvalId).toBe('approval-1');
    expect(payload.plans[0].workflowExecutionId).toBeNull();
  });

  it('never represents a plan as executed and instructs the model not to', async () => {
    const block = planBlock(await run('Generate a customer recovery workflow.'));

    expect(block).toContain('Every plan is awaiting approval and none has been executed');
    expect(block).toContain('never describe a plan as done, started or executed');
    expect(block).toContain('never offer to run one');
    expect(block).not.toContain('"executed":true');
  });

  it('keeps the insights, decisions and orchestration blocks alongside the plan block', async () => {
    const workspaceContext = await run("Create a plan for today's priorities.");
    for (const prefix of [
      'Deterministic executive insights',
      'Deterministic executive decisions',
      'Deterministic multi-agent orchestration',
      'Deterministic approval-gated workflow plans',
    ]) {
      expect(workspaceContext.some((entry) => entry.startsWith(prefix))).toBe(true);
    }
  });

  it('offers planning prompts in a new session', async () => {
    const session = await assistant.createSession();
    expect(session.suggestedPrompts).toEqual(
      expect.arrayContaining([
        "Create a plan for today's priorities.",
        'Build an executive action plan.',
      ]),
    );
  });
});

describe('Workflow plan streaming', () => {
  const { AutonomousWorkflowPlansService: RealService } = jest.requireActual<
    typeof import('../src/modules/ai/workflow-engine/workflow-engine.service')
  >('../src/modules/ai/workflow-engine/workflow-engine.service');
  const { AutonomousWorkflowEngine } = jest.requireActual<
    typeof import('../src/modules/ai/workflow-engine/workflow-engine.engine')
  >('../src/modules/ai/workflow-engine/workflow-engine.engine');

  function buildService(
    overrides: {
      decisions?: ExecutiveDecisionsResult;
      generateFromError?: Error;
    } = {},
  ) {
    const decisions = overrides.decisions ?? DECISIONS;
    const service = new RealService(
      { getExecutiveContext: jest.fn().mockResolvedValue(CONTEXT) } as never,
      { generate: jest.fn().mockResolvedValue(INSIGHTS) } as never,
      { generateFrom: jest.fn().mockResolvedValue(decisions) } as never,
      new AutonomousWorkflowEngine(),
      { upsertGenerated: jest.fn().mockResolvedValue(PLAN), list: jest.fn() } as never,
      { submit: jest.fn().mockResolvedValue(PLAN) } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      {
        recordGenerated: jest.fn(),
        recordGenerationDuration: jest.fn(),
        recordCategory: jest.fn(),
        recordPriority: jest.fn(),
        recordStepCount: jest.fn(),
        recordStatus: jest.fn(),
      } as never,
    );
    if (overrides.generateFromError) {
      jest.spyOn(service, 'generateFrom').mockRejectedValue(overrides.generateFromError);
    }
    return service;
  }

  async function collect(
    stream: AsyncGenerator<WorkflowPlanStreamEvent, void>,
  ): Promise<WorkflowPlanStreamEvent[]> {
    const events: WorkflowPlanStreamEvent[] = [];
    for await (const event of stream) events.push(event);
    return events;
  }

  it('emits events in the documented order and ends with a completed plan set', async () => {
    const events = await collect(buildService().stream([], 'Plan today'));
    const types = events.map((event) => event.type);

    expect(types[0]).toBe('plan_started');
    expect(types[1]).toBe('source_loaded');
    expect(types.at(-1)).toBe('plan_completed');
    expect(types).not.toContain('plan_failed');
  });

  it('stops promptly when the client cancels', async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await collect(buildService().stream([], 'Plan today', controller.signal));

    expect(events.map((event) => event.type)).toEqual(['plan_started']);
  });

  it('stops when the client disconnects mid-stream', async () => {
    const controller = new AbortController();
    const stream = buildService().stream([], 'Plan today', controller.signal);
    const events: WorkflowPlanStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
      if (event.type === 'source_loaded') controller.abort();
    }

    expect(events.map((event) => event.type)).not.toContain('plan_completed');
  });

  it('emits a safe error event rather than throwing or leaking internals', async () => {
    const boom = new Error('decision service unavailable');
    boom.name = 'DecisionServiceError';
    const events = await collect(buildService({ generateFromError: boom }).stream([], 'Plan'));
    const failure = events.find((event) => event.type === 'plan_failed');

    expect(failure).toEqual({
      type: 'plan_failed',
      code: 'DecisionServiceError',
      message: 'decision service unavailable',
    });
    expect(JSON.stringify(failure)).not.toContain('at Object');
    expect(JSON.stringify(failure)).not.toContain('stack');
  });

  it('never streams hidden reasoning — only the documented event shapes', async () => {
    const events = await collect(buildService().stream([], 'Plan today'));
    const allowed = new Set([
      'plan_started',
      'source_loaded',
      'step_generated',
      'approval_submitted',
      'plan_completed',
      'plan_failed',
    ]);

    for (const event of events) {
      expect(allowed.has(event.type)).toBe(true);
      const serialized = JSON.stringify(event);
      for (const forbidden of [
        'reasoning',
        'thought',
        'chain_of_thought',
        'scratchpad',
        'prompt',
      ]) {
        expect(serialized.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});
