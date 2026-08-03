import { AutonomousWorkflowPlansService } from '../src/modules/ai/workflow-engine/workflow-engine.service';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { RunAutonomousAgentDto } from '../src/modules/ai/agents/dto/autonomous-agent.dto';
import { AssistantService } from '../src/modules/ai/assistant/assistant.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { ExecutiveContext } from '../src/modules/ai/context/context.types';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveDecisionEngine } from '../src/modules/ai/decision/decision.engine';
import { ExecutiveDecisionsService } from '../src/modules/ai/decision/decision.service';
import { ExecutiveInsightsEngine } from '../src/modules/ai/insights/insights.engine';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { OrchestratorEngine } from '../src/modules/ai/orchestrator/orchestrator.engine';
import { OrchestratorMetrics } from '../src/modules/ai/orchestrator/orchestrator.metrics';
import {
  OrchestratorCircuitBreaker,
  OrchestratorPolicy,
} from '../src/modules/ai/orchestrator/orchestrator.policy';
import { OrchestratorRegistry } from '../src/modules/ai/orchestrator/orchestrator.registry';
import { OrchestratorService } from '../src/modules/ai/orchestrator/orchestrator.service';
import { OrchestrationResult } from '../src/modules/ai/orchestrator/orchestrator.types';
import { AuditService } from '../src/modules/audit/audit.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

/**
 * Proves the Executive Assistant delegates coordination to the
 * Orchestrator rather than coordinating agents itself, and that the merged
 * result — conflicts, consensus and approval flags intact — reaches the
 * existing agent runtime.
 */
describe('Assistant multi-agent orchestrator integration', () => {
  const context: ExecutiveContext = {
    organization: { id: 'tenant-1' },
    user: { id: 'user-1' },
    crm: {
      total: 3,
      summary: '3 records included.',
      items: [
        { id: 'opportunity:a', label: 'Renewal A', priority: 'high', amount: 250_000 },
        { id: 'opportunity:b', label: 'Renewal B', priority: 'high', amount: 180_000 },
        { id: 'opportunity:c', label: 'Renewal C', priority: 'critical', amount: 120_000 },
      ],
    },
    finance: {
      total: 2,
      summary: '2 records included.',
      items: [
        {
          id: 'finance:current-month-overview',
          label: 'Current-month finance overview',
          priority: 'high',
          details: { type: 'finance_overview', budgetUtilization: 0.95 },
        },
        { id: 'transaction:a', label: 'Pending invoice', priority: 'high', amount: 4_500 },
      ],
    },
    operations: {
      total: 1,
      summary: '1 records included.',
      items: [{ id: 'workflow-run:a', label: 'Failed workflow run', priority: 'critical' }],
    },
    communications: {
      total: 1,
      summary: '1 records included.',
      items: [{ id: 'conversation:a', label: 'Escalated ticket', priority: 'critical' }],
    },
    notifications: { total: 0, summary: 'No data available.', items: [] },
    calendar: { total: 0, summary: 'No data available.', items: [] },
    metadata: {
      generatedAt: '2026-08-02T00:00:00.000Z',
      contextVersion: '1.0',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourcesIncluded: ['crm', 'finance', 'operations', 'communications'],
      excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
      tokenEstimate: 512,
    },
  };

  const PERMISSIONS = [
    'ai.agent.run',
    'sales.opportunity.read',
    'sales.lead.read',
    'finance.transaction.read',
    'finance.budget.read',
    'sales.activity.read',
    'workflow.read',
    'communications.conversation.read',
  ];

  let orchestratorService: OrchestratorService;
  let orchestrateFromSpy: jest.SpyInstance;
  let runStreamMock: jest.Mock;
  let assistant: AssistantService;

  function noopMetrics(): MetricsService {
    return new Proxy({} as MetricsService, {
      get: () => () => undefined,
    });
  }

  beforeEach(() => {
    const contextService = {
      getExecutiveContext: jest.fn().mockResolvedValue(context),
    } as unknown as ExecutiveContextService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const metricsService = noopMetrics();

    const insightsService = new ExecutiveInsightsService(
      contextService,
      new ExecutiveInsightsEngine(),
      audit,
      metricsService,
    );
    const decisionsService = new ExecutiveDecisionsService(
      contextService,
      insightsService,
      new ExecutiveDecisionEngine(),
      audit,
      metricsService,
    );

    const registry = new OrchestratorRegistry();
    const orchestratorMetrics = new OrchestratorMetrics(
      new MetricsService({ get: jest.fn().mockReturnValue(false) } as never),
    );
    orchestratorService = new OrchestratorService(
      contextService,
      insightsService,
      decisionsService,
      new OrchestratorPolicy(registry),
      new OrchestratorEngine(registry, new OrchestratorCircuitBreaker(), orchestratorMetrics),
      audit,
      orchestratorMetrics,
    );
    orchestrateFromSpy = jest.spyOn(orchestratorService, 'orchestrateFrom');

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
      } as unknown as ConversationService,
      contextService,
      insightsService,
      { generateFromContext: jest.fn().mockResolvedValue({}) } as never,
      decisionsService,
      orchestratorService,
      {
        generateForAssistant: jest.fn().mockResolvedValue({ plans: [], plansGenerated: 0 }),
      } as unknown as AutonomousWorkflowPlansService,
    );
  });

  async function runAssistant(objective: string): Promise<{
    workspaceContext: string[];
    orchestration: OrchestrationResult;
  }> {
    const stream = assistant.runStream(
      { conversationId: 'conversation-id', objective },
      PERMISSIONS,
    );
    for await (const _event of stream) {
      // drain
    }
    const calls = runStreamMock.mock.calls as Array<[string, RunAutonomousAgentDto]>;
    const dto = calls[0][1];
    const workspaceContext = dto.workspaceContext as string[];
    const block = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic multi-agent orchestration'),
    )!;
    return {
      workspaceContext,
      orchestration: JSON.parse(block.slice(block.indexOf('{'))) as OrchestrationResult,
    };
  }

  it('delegates coordination to the orchestrator instead of coordinating agents itself', async () => {
    const { orchestration } = await runAssistant('What should my company do today?');

    expect(orchestrateFromSpy).toHaveBeenCalledTimes(1);
    expect(orchestration.orchestrationVersion).toBe('1.0');
    expect(orchestration.agents.length).toBeGreaterThan(1);
    // The assistant passes the already-verified context/insights/decisions
    // straight through — it never asks the orchestrator to rebuild them.
    const [, permissions, passedContext] = orchestrateFromSpy.mock.calls[0] as [
      string,
      string[],
      ExecutiveContext,
    ];
    expect(permissions).toEqual(PERMISSIONS);
    expect(passedContext).toBe(context);
  });

  it('reuses the existing agent runtime rather than starting another one', async () => {
    await runAssistant('Review the entire business.');

    expect(runStreamMock).toHaveBeenCalledTimes(1);
    expect(runStreamMock).toHaveBeenCalledWith(
      'assistant-agent-id',
      expect.objectContaining({ conversationId: 'conversation-id' }),
      expect.arrayContaining(['ai.agent.run']),
      undefined,
    );
  });

  it.each([
    ['What should my company do today?', 'executive'],
    ['Coordinate sales and finance.', 'sales'],
    ['Review the entire business.', 'executive'],
    ['Find cross-department risks.', 'executive'],
    ['Summarize executive priorities.', 'executive'],
  ])('answers %s with a routed multi-agent result', async (objective, expectedAgent) => {
    const { orchestration } = await runAssistant(objective);

    expect(orchestration.routing.selectedAgentIds).toContain(expectedAgent);
    expect(orchestration.routing.selectedAgentIds).toContain('planning');
    expect(orchestration.consensus.participatingAgents.length).toBeGreaterThan(0);
  });

  it('carries conflicts and the consensus score into the assistant context', async () => {
    const { workspaceContext, orchestration } = await runAssistant('Review the entire business.');
    const block = workspaceContext.find((entry) =>
      entry.startsWith('Deterministic multi-agent orchestration'),
    )!;

    expect(orchestration.conflicts.length).toBeGreaterThan(0);
    for (const conflict of orchestration.conflicts) {
      expect(conflict.detail.length).toBeGreaterThan(0);
      expect(conflict.resolvedInFavourOf.length).toBeGreaterThan(0);
    }
    expect(orchestration.consensus.explanation.length).toBeGreaterThan(0);
    expect(typeof orchestration.consensus.agreementScore).toBe('number');
    // The prompt tells the model to report conflicts, not resolve them.
    expect(block).toContain('rather than resolving conflicts yourself');
    expect(block).toContain('Do not re-route, re-rank or execute anything');
  });

  it('preserves approval flags and emits no executing recommendation', async () => {
    const { orchestration } = await runAssistant('Coordinate sales and finance.');

    expect(orchestration.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of orchestration.recommendations) {
      expect(recommendation.executes).toBe(false);
    }
    const businessChanging = orchestration.recommendations.filter(
      (recommendation) => recommendation.code !== 'review_top_priority',
    );
    expect(businessChanging.every((recommendation) => recommendation.requiresApproval)).toBe(true);
    expect(orchestration.approvalRequired).toBe(true);
  });

  it('keeps the insights and decisions blocks alongside the orchestration block', async () => {
    const { workspaceContext } = await runAssistant('What should my company do today?');

    expect(
      workspaceContext.some((entry) => entry.startsWith('Deterministic executive insights')),
    ).toBe(true);
    expect(
      workspaceContext.some((entry) => entry.startsWith('Deterministic executive decisions')),
    ).toBe(true);
    expect(
      workspaceContext.some((entry) => entry.startsWith('Deterministic multi-agent orchestration')),
    ).toBe(true);
  });

  it('produces an identical orchestration for the same objective across turns', async () => {
    const first = await runAssistant('Review the entire business.');
    runStreamMock.mockClear();
    const second = await runAssistant('Review the entire business.');

    const normalize = (result: OrchestrationResult) => ({
      ...result,
      executionMs: 0,
      mergeMs: 0,
      agents: result.agents.map((agent) => ({ ...agent, executionMs: 0 })),
    });
    expect(normalize(second.orchestration)).toEqual(normalize(first.orchestration));
  });
});
