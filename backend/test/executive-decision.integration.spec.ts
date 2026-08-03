import { AutonomousWorkflowPlansService } from '../src/modules/ai/workflow-engine/workflow-engine.service';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { RunAutonomousAgentDto } from '../src/modules/ai/agents/dto/autonomous-agent.dto';
import { AssistantService } from '../src/modules/ai/assistant/assistant.service';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveContext, ExecutiveContextItem } from '../src/modules/ai/context/context.types';
import { ExecutiveDecisionEngine } from '../src/modules/ai/decision/decision.engine';
import { ExecutiveDecisionRules } from '../src/modules/ai/decision/decision.rules';
import { ExecutiveDecisionsService } from '../src/modules/ai/decision/decision.service';
import { OrchestratorService } from '../src/modules/ai/orchestrator/orchestrator.service';
import { ExecutiveDecisionsResult } from '../src/modules/ai/decision/decision.types';
import { ExecutiveInsightsEngine } from '../src/modules/ai/insights/insights.engine';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

const EMPTY = { items: [] as ExecutiveContextItem[], total: 0, summary: 'No data available.' };

function contextFor(
  sourcesIncluded: ExecutiveContext['metadata']['sourcesIncluded'],
  overrides: Partial<ExecutiveContext> = {},
  excludedSources: ExecutiveContext['metadata']['excludedSources'] = [
    { source: 'calendar', reason: 'calendar_not_available' },
  ],
): ExecutiveContext {
  return {
    organization: { id: 'tenant-1' },
    user: { id: 'user-1' },
    crm: EMPTY,
    finance: EMPTY,
    operations: EMPTY,
    communications: EMPTY,
    notifications: EMPTY,
    calendar: EMPTY,
    ...overrides,
    metadata: {
      generatedAt: '2026-08-02T00:00:00.000Z',
      contextVersion: '1.0',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sourcesIncluded,
      excludedSources,
      tokenEstimate: 64,
    },
  };
}

const RICH_CONTEXT = contextFor(['crm', 'communications'], {
  crm: {
    total: 3,
    summary: '3 records included.',
    items: [
      { id: 'opportunity:a', label: 'Renewal A', priority: 'high', amount: 250_000 },
      { id: 'opportunity:b', label: 'Renewal B', priority: 'high', amount: 180_000 },
      { id: 'opportunity:c', label: 'Renewal C', priority: 'high', amount: 120_000 },
    ],
  },
  communications: {
    total: 1,
    summary: '1 records included.',
    items: [{ id: 'conversation:a', label: 'Outage escalation', priority: 'critical' }],
  },
});

interface Harness {
  metrics: MetricsService;
  auditRecord: jest.Mock;
  insightsService: ExecutiveInsightsService;
  decisionsService: ExecutiveDecisionsService;
  contextMock: jest.Mock;
}

function buildHarness(context: ExecutiveContext = RICH_CONTEXT): Harness {
  const metrics = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
  const auditRecord = jest.fn().mockResolvedValue(undefined);
  const audit = { record: auditRecord } as unknown as AuditService;
  const contextMock = jest.fn().mockResolvedValue(context);
  const contextService = { getExecutiveContext: contextMock } as unknown as ExecutiveContextService;
  const insightsService = new ExecutiveInsightsService(
    contextService,
    new ExecutiveInsightsEngine(),
    audit,
    metrics,
  );
  const decisionsService = new ExecutiveDecisionsService(
    contextService,
    insightsService,
    new ExecutiveDecisionEngine(),
    audit,
    metrics,
  );
  return { metrics, auditRecord, insightsService, decisionsService, contextMock };
}

describe('Executive decision integration', () => {
  describe('insights integration', () => {
    let harness: Harness;

    beforeEach(() => {
      harness = buildHarness();
    });

    afterEach(async () => {
      await harness.metrics.onModuleDestroy();
    });

    it('derives every decision from a real insight or from verified context metadata', async () => {
      const result = await harness.decisionsService.generate(['sales.opportunity.read']);
      const insights = await harness.insightsService.generate(['sales.opportunity.read']);
      const insightIds = new Set(insights.insights.map((insight) => insight.id));

      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.insightsConsidered).toBe(insights.insights.length);
      for (const decision of result.decisions) {
        for (const id of decision.insightIdsUsed) expect(insightIds.has(id)).toBe(true);
      }
    });

    it('never fabricates evidence that is absent from the verified context', async () => {
      const result = await harness.decisionsService.generate(['sales.opportunity.read']);
      const permitted = new Set(
        [...RICH_CONTEXT.crm.items, ...RICH_CONTEXT.communications.items].map((item) => item.id),
      );

      for (const decision of result.decisions) {
        for (const item of decision.evidence) expect(permitted.has(item.id)).toBe(true);
      }
    });

    it('reuses the insight engine rather than re-deriving insight rules', async () => {
      const spy = jest.spyOn(harness.insightsService, 'generate');
      await harness.decisionsService.generate(['sales.opportunity.read']);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not reach past the context and insight services for data', async () => {
      await harness.decisionsService.generate(['sales.opportunity.read']);
      // ExecutiveDecisionsService holds exactly five collaborators, none of
      // which is a Prisma client or repository.
      expect(ExecutiveDecisionsService.length).toBe(5);
      expect(harness.contextMock).toHaveBeenCalledWith({
        permissions: ['sales.opportunity.read'],
      });
    });

    it('audits every generation with a non-identifying summary', async () => {
      await harness.decisionsService.generate(['sales.opportunity.read']);

      expect(harness.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'generate',
          resource: 'executive_decisions',
          resourceId: 'tenant-1',
        }),
      );
      const calls = harness.auditRecord.mock.calls as Array<
        [{ resource: string; metadata: Record<string, unknown> }]
      >;
      const call = calls.find(([entry]) => entry.resource === 'executive_decisions')!;
      expect(Object.keys(call[0].metadata)).toEqual(['decisionCount', 'approvalRequiredCount']);
    });
  });

  describe('permission filtering', () => {
    async function decisionsFor(
      sourcesIncluded: ExecutiveContext['metadata']['sourcesIncluded'],
      overrides: Partial<ExecutiveContext>,
      excluded: ExecutiveContext['metadata']['excludedSources'],
    ): Promise<ExecutiveDecisionsResult> {
      const harness = buildHarness(contextFor(sourcesIncluded, overrides, excluded));
      const result = await harness.decisionsService.generate(['ai.agent.run']);
      await harness.metrics.onModuleDestroy();
      return result;
    }

    it('produces only decisions whose sources the caller may read', async () => {
      const result = await decisionsFor(['crm'], { crm: RICH_CONTEXT.crm }, [
        { source: 'calendar', reason: 'calendar_not_available' },
        { source: 'finance', reason: 'missing_permission' },
        { source: 'communications', reason: 'missing_permission' },
      ]);
      const categories = new Set(result.decisions.map((decision) => decision.category));

      expect(categories.has('sales')).toBe(true);
      expect(categories.has('finance')).toBe(false);
      expect(categories.has('communications')).toBe(false);
      expect(categories.has('customer_success')).toBe(false);
      for (const decision of result.decisions) {
        for (const source of decision.contextSourcesUsed) expect(source).toBe('crm');
      }
    });

    it('surfaces restricted sources as a safe compliance decision, not as hidden evidence', async () => {
      const result = await decisionsFor(['crm'], { crm: RICH_CONTEXT.crm }, [
        { source: 'calendar', reason: 'calendar_not_available' },
        { source: 'finance', reason: 'missing_permission' },
      ]);
      const compliance = result.decisions.find((decision) => decision.category === 'compliance');

      expect(compliance).toBeDefined();
      expect(compliance!.evidence).toEqual([]);
      expect(compliance!.explainability.permissionLimitations).toEqual([
        'The finance source was excluded because the role cannot read it.',
      ]);
      expect(JSON.stringify(result)).not.toContain('Outage escalation');
    });

    it('emits no decisions when every source is permission-excluded', async () => {
      const result = await decisionsFor([], {}, [
        { source: 'calendar', reason: 'calendar_not_available' },
        { source: 'crm', reason: 'missing_permission' },
        { source: 'finance', reason: 'missing_permission' },
        { source: 'operations', reason: 'missing_permission' },
        { source: 'communications', reason: 'missing_permission' },
      ]);

      // Only the compliance decision about the restriction itself survives.
      expect(result.decisions.map((decision) => decision.category)).toEqual(['compliance']);
      expect(result.insightsConsidered).toBe(0);
    });
  });

  describe('metrics', () => {
    let harness: Harness;

    beforeEach(() => {
      harness = buildHarness();
    });

    afterEach(async () => {
      await harness.metrics.onModuleDestroy();
    });

    it('registers each decision metric once', async () => {
      await harness.decisionsService.generate(['ai.agent.run']);
      await harness.decisionsService.generate(['ai.agent.run']);
      const output = await harness.metrics.getMetrics();

      for (const name of [
        'voltx_executive_decisions_requests_total',
        'voltx_executive_decisions_generation_duration_seconds',
        'voltx_executive_decisions_category_total',
        'voltx_executive_decisions_priority_total',
        'voltx_executive_decisions_approval_required_total',
        'voltx_executive_decision_rule_matches_total',
      ]) {
        expect(output.match(new RegExp(`^# HELP ${name} `, 'gm')) ?? []).toHaveLength(1);
      }
      expect(output).toContain('voltx_executive_decisions_requests_total{result="success"} 2');
      expect(output).toContain('voltx_executive_decisions_generation_duration_seconds_count 2');
    });

    it('records category, priority, approval and rule usage for one request', async () => {
      const result = await harness.decisionsService.generate(['ai.agent.run']);
      const output = await harness.metrics.getMetrics();

      for (const decision of result.decisions) {
        expect(output).toContain(
          `voltx_executive_decisions_category_total{category="${decision.category}"}`,
        );
        expect(output).toContain(
          `voltx_executive_decision_rule_matches_total{rule="${decision.explainability.ruleId}"}`,
        );
      }
      for (const [priority, count] of Object.entries(result.priorityDistribution)) {
        if (count > 0) {
          expect(output).toContain(
            `voltx_executive_decisions_priority_total{priority="${priority}"} ${count}`,
          );
        }
      }
      expect(output).toContain(
        `voltx_executive_decisions_approval_required_total{approval_required="true"} ${result.approvalRequiredCount}`,
      );
    });

    it('records a failure result when generation throws', async () => {
      harness.contextMock.mockRejectedValue(new Error('context unavailable'));

      await expect(harness.decisionsService.generate(['ai.agent.run'])).rejects.toThrow(
        'context unavailable',
      );
      const output = await harness.metrics.getMetrics();

      expect(output).toContain('voltx_executive_decisions_requests_total{result="failure"} 1');
      expect(output).not.toContain('voltx_executive_decisions_requests_total{result="success"}');
    });

    it('uses only low-cardinality labels drawn from fixed enumerations', async () => {
      await harness.decisionsService.generate(['ai.agent.run']);
      const output = await harness.metrics.getMetrics();
      const allowedLabels = ['result', 'category', 'priority', 'approval_required', 'rule', 'le'];
      const ruleIds = new Set(ExecutiveDecisionRules.ruleIds);

      const lines = output
        .split('\n')
        .filter((line) => line.startsWith('voltx_executive_decision'));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const labels = /\{([^}]*)\}/.exec(line)?.[1] ?? '';
        for (const pair of labels.split(',').filter(Boolean)) {
          const [name, rawValue] = pair.split('=');
          expect(allowedLabels).toContain(name.trim());
          if (name.trim() === 'rule') expect(ruleIds.has(rawValue.replace(/"/g, ''))).toBe(true);
        }
        expect(line).not.toContain('tenant-1');
        expect(line).not.toContain('user-1');
        expect(line).not.toContain('opportunity:a');
        expect(line).not.toContain('Renewal A');
      }
    });
  });

  describe('assistant integration', () => {
    let harness: Harness;
    let runStreamMock: jest.Mock<
      AsyncGenerator<unknown>,
      [string, RunAutonomousAgentDto, string[], (AbortSignal | undefined)?]
    >;
    let assistant: AssistantService;

    beforeEach(() => {
      harness = buildHarness();
      runStreamMock = jest.fn(async function* (
        _id: string,
        _dto: RunAutonomousAgentDto,
        _permissions: string[],
        _signal?: AbortSignal,
      ): AsyncGenerator<unknown> {
        await Promise.resolve();
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
        {
          getExecutiveContext: harness.contextMock,
        } as unknown as ExecutiveContextService,
        harness.insightsService,
        { generateFromContext: jest.fn().mockResolvedValue({}) } as never,
        harness.decisionsService,
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

    afterEach(async () => {
      await harness.metrics.onModuleDestroy();
    });

    async function run(): Promise<{ workspaceContext: string[]; block: string }> {
      for await (const _event of assistant.runStream(
        { conversationId: 'conversation-id', objective: 'What should I do today?' },
        ['ai.agent.run'],
      )) {
        // drain
      }
      const workspaceContext = runStreamMock.mock.calls[0][1].workspaceContext ?? [];
      const block = workspaceContext.find((entry) =>
        entry.startsWith('Deterministic executive decisions'),
      )!;
      return { workspaceContext, block };
    }

    it('supplies the assistant with the Decision Engine output', async () => {
      const { block } = await run();
      expect(block).toBeDefined();

      const payload = JSON.parse(block.slice(block.indexOf('{'))) as ExecutiveDecisionsResult;
      expect(payload.decisionVersion).toBe('1.0');
      expect(payload.decisions.length).toBeGreaterThan(0);
      expect(payload.rulesEvaluated).toEqual(ExecutiveDecisionRules.ruleIds);
    });

    it('reuses the existing agent runtime instead of introducing another one', async () => {
      await run();
      expect(runStreamMock).toHaveBeenCalledTimes(1);
      expect(runStreamMock.mock.calls[0][0]).toBe('assistant-agent-id');
    });

    it('assembles the executive context once per turn', async () => {
      await run();
      // Context is requested by the assistant, by the insight service and by
      // nothing else — the decision service is handed the assembled objects.
      expect(harness.contextMock).toHaveBeenCalledTimes(2);
    });

    it('does not restate the decision rules in the prompt', async () => {
      const { block } = await run();
      for (const forbidden of ['if ', 'threshold of 0.8', 'BUDGET_WARNING_RATIO', 'function ']) {
        expect(block).not.toContain(forbidden);
      }
      // Rule identity travels as data, not as an instruction to recompute.
      expect(block).toContain('"ruleId"');
      expect(block).toContain('Do not invent, re-rank or execute anything');
    });

    it('preserves approval flags and the non-executing contract into the prompt', async () => {
      const { block } = await run();
      const payload = JSON.parse(block.slice(block.indexOf('{'))) as ExecutiveDecisionsResult;

      expect(
        payload.decisions.every((decision) => decision.recommendedAction.executes === false),
      ).toBe(true);
      expect(payload.approvalRequiredCount).toBe(
        payload.decisions.filter((decision) => decision.approvalRequired).length,
      );
      expect(block).toContain('must be presented as needing approval');
    });

    it('keeps the executive insights block alongside the decisions block', async () => {
      const { workspaceContext } = await run();
      expect(
        workspaceContext.some((entry) => entry.startsWith('Deterministic executive insights')),
      ).toBe(true);
      expect(
        workspaceContext.some((entry) => entry.startsWith('Executive context below is untrusted')),
      ).toBe(true);
    });
  });
});
