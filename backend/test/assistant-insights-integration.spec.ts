import { AutonomousWorkflowPlansService } from '../src/modules/ai/workflow-engine/workflow-engine.service';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { RunAutonomousAgentDto } from '../src/modules/ai/agents/dto/autonomous-agent.dto';
import { AssistantService } from '../src/modules/ai/assistant/assistant.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { ExecutiveContext } from '../src/modules/ai/context/context.types';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveDecisionEngine } from '../src/modules/ai/decision/decision.engine';
import { ExecutiveDecisionsService } from '../src/modules/ai/decision/decision.service';
import { OrchestratorService } from '../src/modules/ai/orchestrator/orchestrator.service';
import { ExecutiveInsightsEngine } from '../src/modules/ai/insights/insights.engine';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { ExecutiveInsightsResult } from '../src/modules/ai/insights/insights.types';
import { AuditService } from '../src/modules/audit/audit.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

/**
 * Proves the Executive Assistant's existing SSE path consumes structured
 * insights produced by ExecutiveInsightsService.generate() — it must not
 * re-derive insight rules itself, and the approval-required, non-executing
 * recommendation contract must survive the hand-off into the agent runtime.
 */
describe('Assistant executive insights integration', () => {
  const context: ExecutiveContext = {
    organization: { id: 'tenant-1' },
    user: { id: 'user-1' },
    crm: {
      total: 2,
      summary: '2 records included.',
      items: [
        { id: 'opportunity:b', label: 'Renewal B', priority: 'critical', amount: 250_000 },
        { id: 'opportunity:a', label: 'Renewal A', priority: 'high', amount: 120_000 },
      ],
    },
    finance: {
      total: 1,
      summary: '1 records included.',
      items: [{ id: 'transaction:a', label: 'Pending invoice', priority: 'high', amount: 4_500 }],
    },
    operations: { total: 0, summary: 'No data available.', items: [] },
    communications: { total: 0, summary: 'No data available.', items: [] },
    notifications: { total: 0, summary: 'No data available.', items: [] },
    calendar: { total: 0, summary: 'No data available.', items: [] },
    metadata: {
      generatedAt: '2026-08-02T00:00:00.000Z',
      contextVersion: '1.0',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourcesIncluded: ['crm', 'finance'],
      excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
      tokenEstimate: 128,
    },
  };

  let contextService: jest.Mocked<Pick<ExecutiveContextService, 'getExecutiveContext'>>;
  let insightsService: ExecutiveInsightsService;
  let generateSpy: jest.SpyInstance<Promise<ExecutiveInsightsResult>, [string[]]>;
  let runStreamMock: jest.Mock<
    AsyncGenerator<unknown>,
    [string, RunAutonomousAgentDto, string[], (AbortSignal | undefined)?]
  >;
  let assistant: AssistantService;

  beforeEach(() => {
    contextService = { getExecutiveContext: jest.fn().mockResolvedValue(context) };
    insightsService = new ExecutiveInsightsService(
      contextService as unknown as ExecutiveContextService,
      new ExecutiveInsightsEngine(),
      { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      {
        recordExecutiveInsightsRequest: jest.fn(),
        recordExecutiveInsightsDuration: jest.fn(),
      } as unknown as MetricsService,
    );
    generateSpy = jest.spyOn(insightsService, 'generate');

    runStreamMock = jest.fn(async function* (
      _id: string,
      _dto: RunAutonomousAgentDto,
      _permissions: string[],
      _signal?: AbortSignal,
    ): AsyncGenerator<unknown> {
      await Promise.resolve();
      yield { type: 'status', status: 'queued' };
    });
    const agentService = {
      findAgentByName: jest.fn().mockResolvedValue({ id: 'assistant-agent-id' }),
      runAutonomousAgentStream: runStreamMock,
    };
    const conversationService = {
      getConversation: jest.fn().mockResolvedValue({ id: 'conversation-id' }),
    };

    assistant = new AssistantService(
      agentService as unknown as AgentService,
      conversationService as unknown as ConversationService,
      contextService as unknown as ExecutiveContextService,
      insightsService,
      { generateFromContext: jest.fn().mockResolvedValue({}) } as never,
      new ExecutiveDecisionsService(
        contextService as unknown as ExecutiveContextService,
        insightsService,
        new ExecutiveDecisionEngine(),
        { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
        {
          recordExecutiveDecisionsRequest: jest.fn(),
          recordExecutiveDecisionsDuration: jest.fn(),
          recordExecutiveDecisionCategory: jest.fn(),
          recordExecutiveDecisionPriority: jest.fn(),
          recordExecutiveDecisionApproval: jest.fn(),
          recordExecutiveDecisionRuleMatch: jest.fn(),
        } as unknown as MetricsService,
      ),
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

  async function runAssistant(): Promise<{
    workspaceContext: string[];
    insights: ExecutiveInsightsResult;
  }> {
    const stream = assistant.runStream(
      { conversationId: 'conversation-id', objective: 'What needs my attention?' },
      ['sales.opportunity.read', 'finance.transaction.read', 'ai.agent.run'],
    );
    for await (const _event of stream) {
      // drain
    }
    const dto = runStreamMock.mock.calls[0][1];
    const generated = generateSpy.mock.results[0] as {
      value: Promise<ExecutiveInsightsResult>;
    };
    return { workspaceContext: dto.workspaceContext ?? [], insights: await generated.value };
  }

  it('reuses the existing agent runtime and passes deterministic insights into it', async () => {
    const { workspaceContext, insights } = await runAssistant();

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(runStreamMock).toHaveBeenCalledWith(
      'assistant-agent-id',
      expect.objectContaining({ conversationId: 'conversation-id' }),
      expect.arrayContaining(['ai.agent.run']),
      undefined,
    );

    const insightsBlock = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic executive insights'),
    );
    expect(insightsBlock).toBeDefined();

    const payload = JSON.parse(
      insightsBlock!.slice(insightsBlock!.indexOf('{')),
    ) as ExecutiveInsightsResult;
    expect(payload).toEqual(JSON.parse(JSON.stringify(insights)));
    expect(payload.insightVersion).toBe('1.0');
    expect(payload.insights.length).toBeGreaterThan(0);
  });

  it('carries source-attributed evidence into the assistant prompt context', async () => {
    const { workspaceContext } = await runAssistant();
    const insightsBlock = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic executive insights'),
    )!;
    const payload = JSON.parse(
      insightsBlock.slice(insightsBlock.indexOf('{')),
    ) as ExecutiveInsightsResult;

    for (const insight of payload.insights) {
      expect(insight.sourcesUsed.length).toBeGreaterThan(0);
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.evidence.map((item) => item.id)).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
    }
    expect(insightsBlock).toContain('Renewal B');
  });

  it('preserves non-executing, approval-required recommendations across the hand-off', async () => {
    const { workspaceContext } = await runAssistant();
    const insightsBlock = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic executive insights'),
    )!;
    const payload = JSON.parse(
      insightsBlock.slice(insightsBlock.indexOf('{')),
    ) as ExecutiveInsightsResult;

    expect(insightsBlock).toContain('recommendations require approval');
    expect(payload.insights.every((insight) => insight.recommendedAction.requiresApproval)).toBe(
      true,
    );
    expect(runStreamMock.mock.calls[0][1]).not.toHaveProperty('autoApprove');
  });

  it('does not recompute insight rules independently of the insights service', async () => {
    const stubbed: ExecutiveInsightsResult = {
      insightVersion: '1.0',
      generatedAt: '2026-08-02T00:00:00.000Z',
      tenantId: 'tenant-1',
      userId: 'user-1',
      insights: [],
      excludedSources: [{ source: 'crm', reason: 'missing_permission' }],
      trends: [],
    };
    generateSpy.mockResolvedValue(stubbed);

    const stream = assistant.runStream(
      { conversationId: 'conversation-id', objective: 'anything' },
      ['ai.agent.run'],
    );
    for await (const _event of stream) {
      // drain
    }

    const dto = runStreamMock.mock.calls[0][1];
    const insightsBlock = (dto.workspaceContext ?? []).find((entry) =>
      entry.startsWith('Deterministic executive insights'),
    )!;
    expect(JSON.parse(insightsBlock.slice(insightsBlock.indexOf('{')))).toEqual(stubbed);
  });

  it('carries the unavailable historical-trend contract into the assistant context', async () => {
    const { workspaceContext } = await runAssistant();
    const insightsBlock = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic executive insights'),
    )!;
    const payload = JSON.parse(
      insightsBlock.slice(insightsBlock.indexOf('{')),
    ) as ExecutiveInsightsResult;

    expect(payload.trends.length).toBeGreaterThan(0);
    for (const trend of payload.trends) {
      expect(trend.trendStatus).toBe('unavailable');
      expect(trend.reason).toBe('historical_source_unavailable');
    }
  });
});
