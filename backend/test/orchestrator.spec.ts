import { ExecutiveContext, ExecutiveContextItem } from '../src/modules/ai/context/context.types';
import { ExecutiveDecisionEngine } from '../src/modules/ai/decision/decision.engine';
import { ExecutiveDecisionsResult } from '../src/modules/ai/decision/decision.types';
import { ExecutiveInsightsRules } from '../src/modules/ai/insights/insights.rules';
import { ExecutiveInsightsResult } from '../src/modules/ai/insights/insights.types';
import {
  AgentTimeoutError,
  OrchestrationCancelledError,
  OrchestratorEngine,
} from '../src/modules/ai/orchestrator/orchestrator.engine';
import { OrchestratorMetrics } from '../src/modules/ai/orchestrator/orchestrator.metrics';
import {
  AGENT_MAX_ATTEMPTS,
  AGENT_TIMEOUT_MS,
  CIRCUIT_COOLDOWN_MS,
  CIRCUIT_FAILURE_THRESHOLD,
  OrchestratorCircuitBreaker,
  OrchestratorPolicy,
  tokenize,
} from '../src/modules/ai/orchestrator/orchestrator.policy';
import {
  AGENT_VERSION,
  ORCHESTRATOR_AGENTS,
  OrchestratorRegistry,
} from '../src/modules/ai/orchestrator/orchestrator.registry';
import {
  AgentCapability,
  AgentInterface,
  AgentOutput,
  AgentResult,
  AgentRunInput,
} from '../src/modules/ai/orchestrator/orchestrator.types';
import { MetricsService } from '../src/modules/metrics/metrics.service';

const EMPTY = { items: [] as ExecutiveContextItem[], total: 0, summary: 'No data available.' };

function item(
  id: string,
  priority: ExecutiveContextItem['priority'],
  extra: Partial<ExecutiveContextItem> = {},
): ExecutiveContextItem {
  return { id, label: `Record ${id}`, priority, ...extra };
}

function buildContext(overrides: Partial<ExecutiveContext> = {}): ExecutiveContext {
  const sourcesIncluded = overrides.metadata?.sourcesIncluded ?? [
    'crm',
    'finance',
    'operations',
    'communications',
  ];
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
      excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
      tokenEstimate: 64,
      ...overrides.metadata,
    },
  };
}

function insightsFor(context: ExecutiveContext): ExecutiveInsightsResult {
  return {
    insightVersion: '1.0',
    generatedAt: context.metadata.generatedAt,
    tenantId: context.metadata.tenantId,
    userId: context.metadata.userId,
    insights: ExecutiveInsightsRules.generate(context),
    excludedSources: context.metadata.excludedSources,
    trends: context.metadata.sourcesIncluded.map((source) => ({
      source,
      trendStatus: 'unavailable' as const,
      reason: 'historical_source_unavailable' as const,
    })),
  };
}

function decisionsFor(context: ExecutiveContext): ExecutiveDecisionsResult {
  return new ExecutiveDecisionEngine().build(context, insightsFor(context));
}

/** A context rich enough that several domains produce decisions. */
const RICH_CONTEXT = buildContext({
  crm: {
    total: 3,
    summary: '3 records included.',
    items: [
      item('opportunity:a', 'high', { amount: 250_000 }),
      item('opportunity:b', 'high', { amount: 180_000 }),
      item('opportunity:c', 'high', { amount: 120_000 }),
    ],
  },
  finance: {
    total: 2,
    summary: '2 records included.',
    items: [
      item('finance:current-month-overview', 'high', {
        details: { type: 'finance_overview', budgetUtilization: 0.92 },
      }),
      item('transaction:a', 'high'),
    ],
  },
  operations: {
    total: 6,
    summary: '6 records included.',
    items: Array.from({ length: 6 }, (_, index) => item(`activity:${index}`, 'medium')),
  },
  communications: {
    total: 2,
    summary: '2 records included.',
    items: [item('conversation:a', 'critical'), item('conversation:b', 'high')],
  },
  metadata: {
    // A realistic role: it reads four sources but not notifications, so
    // visibility is restricted and the compliance lens has something to say.
    excludedSources: [
      { source: 'calendar', reason: 'calendar_not_available' },
      { source: 'notifications', reason: 'missing_permission' },
    ],
  } as ExecutiveContext['metadata'],
});

const ALL_PERMISSIONS = [
  'ai.agent.run',
  'ai.approval.decide',
  'sales.opportunity.read',
  'sales.opportunity.update',
  'sales.lead.read',
  'sales.activity.read',
  'sales.activity.create',
  'sales.activity.update',
  'finance.transaction.read',
  'finance.transaction.update',
  'finance.budget.read',
  'finance.budget.update',
  'workflow.read',
  'communications.conversation.read',
  'communications.conversation.update',
  'communications.message.create',
  'role.read',
  'permission.read',
];

function buildEngine() {
  const metricsService = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
  const metrics = new OrchestratorMetrics(metricsService);
  const registry = new OrchestratorRegistry();
  const breaker = new OrchestratorCircuitBreaker();
  return {
    metricsService,
    metrics,
    registry,
    breaker,
    engine: new OrchestratorEngine(registry, breaker, metrics),
    policy: new OrchestratorPolicy(registry),
  };
}

function runInput(overrides: Partial<AgentRunInput> = {}): AgentRunInput {
  return {
    objective: 'Review the entire business.',
    permissions: ALL_PERMISSIONS,
    context: RICH_CONTEXT,
    insights: insightsFor(RICH_CONTEXT),
    decisions: decisionsFor(RICH_CONTEXT),
    upstream: [],
    ...overrides,
  };
}

/** A configurable fake agent for exercising the execution policy. */
function fakeAgent(
  id: string,
  behaviour: () => Promise<AgentOutput>,
  mode: 'parallel' | 'sequential' = 'parallel',
): AgentInterface {
  return {
    id,
    name: id,
    version: '1.0',
    supportedCapabilities: ['executive_summary'],
    requiredPermissions: ['ai.agent.run'],
    supportedContextSources: ['crm'],
    mode,
    run: behaviour,
  };
}

const EMPTY_OUTPUT: AgentOutput = {
  summary: 'ok',
  assessments: [],
  recommendations: [],
  evidence: [],
  decisionIds: [],
  insightIds: [],
  confidence: 'high',
  businessImpact: 'low',
  priority: 'low',
  sourcesUsed: [],
};

describe('OrchestratorRegistry', () => {
  it('registers all eight specialized agents with a stable order', () => {
    expect(ORCHESTRATOR_AGENTS.map((agent) => agent.name)).toEqual([
      'ExecutiveAgent',
      'SalesAgent',
      'FinanceAgent',
      'OperationsAgent',
      'CommunicationsAgent',
      'CustomerSuccessAgent',
      'ComplianceAgent',
      'PlanningAgent',
    ]);
  });

  it('gives every agent the full AgentInterface contract', () => {
    for (const agent of ORCHESTRATOR_AGENTS) {
      expect(typeof agent.id).toBe('string');
      expect(typeof agent.name).toBe('string');
      expect(agent.version).toBe(AGENT_VERSION);
      expect(agent.supportedCapabilities.length).toBeGreaterThan(0);
      expect(agent.requiredPermissions.length).toBeGreaterThan(0);
      expect(agent.supportedContextSources.length).toBeGreaterThan(0);
      expect(typeof agent.run).toBe('function');
    }
  });

  it('exposes registry order as conflict precedence', () => {
    const registry = new OrchestratorRegistry();
    expect(registry.precedenceOf('executive')).toBe(0);
    expect(registry.precedenceOf('planning')).toBe(ORCHESTRATOR_AGENTS.length - 1);
    expect(registry.precedenceOf('sales')).toBeLessThan(registry.precedenceOf('compliance'));
    expect(registry.precedenceOf('unknown-agent')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('resolves agents by capability and id', () => {
    const registry = new OrchestratorRegistry();
    expect(registry.byCapability('pipeline_analysis').map((agent) => agent.id)).toEqual(['sales']);
    expect(registry.byCapability('budget_analysis').map((agent) => agent.id)).toEqual(['finance']);
    expect(registry.get('operations')?.name).toBe('OperationsAgent');
    expect(registry.get('nope')).toBeUndefined();
  });

  it('runs every agent purely from context, insights and decisions', async () => {
    const input = runInput();
    for (const agent of ORCHESTRATOR_AGENTS) {
      const output = await agent.run(input);
      expect(Array.isArray(output.assessments)).toBe(true);
      expect(output.summary.length).toBeGreaterThan(0);
      // Every decision id an agent reports must exist in the decision set.
      const known = new Set(input.decisions.decisions.map((decision) => decision.id));
      for (const id of output.decisionIds) expect(known.has(id)).toBe(true);
    }
  });
});

describe('OrchestratorPolicy routing', () => {
  const { policy } = buildEngine();

  it('tokenizes objectives into whole words and bounds the input', () => {
    expect(tokenize('Revenue, pipeline & TASKS!')).toEqual(['revenue', 'pipeline', 'tasks']);
    expect(tokenize('word '.repeat(500)).length).toBe(200);
  });

  it.each([
    ['Show me revenue this quarter', 'finance'],
    ['How is the pipeline?', 'sales'],
    ['What tasks are blocked?', 'operations'],
    ['Any customer escalations?', 'customer_success'],
    ['Run a compliance check', 'compliance'],
  ])('routes %s to %s', (objective, expectedAgent) => {
    expect(policy.route(objective).agents.map((agent) => agent.id)).toContain(expectedAgent);
  });

  it('selects multiple agents for a multi-domain objective', () => {
    const routed = policy.route('Coordinate sales and finance.');
    const ids = routed.agents.map((agent) => agent.id);

    expect(ids).toContain('sales');
    expect(ids).toContain('finance');
    expect(routed.capabilities).toContain('pipeline_analysis');
    expect(routed.capabilities).toContain('revenue_analysis');
  });

  it('keeps a narrow objective narrow instead of expanding it', () => {
    const routed = policy.route('How is the pipeline?');

    expect(routed.rule).toBe('term_match');
    expect(routed.agents.map((agent) => agent.id)).toEqual(['sales', 'planning']);
  });

  it('expands a broad-review term to every domain agent', () => {
    const routed = policy.route('Review the entire business.');
    const ids = routed.agents.map((agent) => agent.id);

    expect(routed.rule).toBe('term_match_broad_review');
    for (const expected of [
      'executive',
      'sales',
      'finance',
      'operations',
      'communications',
      'customer_success',
      'compliance',
      'planning',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('always appends the planning capability so results get sequenced', () => {
    expect(policy.route('How is the pipeline?').capabilities).toContain('action_planning');
    expect(policy.route('How is the pipeline?').agents.map((agent) => agent.id)).toContain(
      'planning',
    );
  });

  it('falls back to a broad review when nothing matches', () => {
    const routed = policy.route('zzzz qqqq');
    expect(routed.rule).toBe('fallback_broad_review');
    expect(routed.matchedTerms).toEqual([]);
    // An unrecognised objective is treated as a broad review: engage every
    // agent rather than silently answering from the executive lens alone.
    expect(routed.agents.map((agent) => agent.id)).toEqual([
      'executive',
      'sales',
      'finance',
      'operations',
      'communications',
      'customer_success',
      'compliance',
      'planning',
    ]);
  });

  it('is repeatable and case-insensitive', () => {
    const first = policy.route('Coordinate SALES and Finance.');
    const second = policy.route('coordinate sales and finance');
    expect(first.capabilities).toEqual(second.capabilities);
    expect(first.agents.map((agent) => agent.id)).toEqual(second.agents.map((agent) => agent.id));
  });

  it('routes on whole words only, never substrings', () => {
    // "salesforce" must not trigger the "sales" term.
    expect(policy.route('salesforce integration').matchedTerms).not.toContain('sales');
  });
});

describe('OrchestratorPolicy permission validation', () => {
  const { policy } = buildEngine();

  it('skips agents whose required permissions the role lacks', () => {
    const verdict = policy.validate([...ORCHESTRATOR_AGENTS], ['ai.agent.run'], RICH_CONTEXT);
    const skippedIds = verdict.rejected.map((entry) => entry.agent.id);

    expect(skippedIds).toContain('sales');
    expect(skippedIds).toContain('finance');
    expect(verdict.eligible.map((agent) => agent.id)).toContain('executive');
    for (const entry of verdict.rejected) {
      expect(entry.status).toBe('skipped_permission');
      // The reason must not disclose which permission key is missing.
      expect(entry.reason).not.toMatch(/\.[a-z]+\.[a-z]+/);
    }
  });

  it('skips agents whose context sources were all filtered out', () => {
    const noCrm = buildContext({
      metadata: { sourcesIncluded: ['finance'] } as ExecutiveContext['metadata'],
    });
    const verdict = policy.validate([...ORCHESTRATOR_AGENTS], ALL_PERMISSIONS, noCrm);

    expect(verdict.rejected.find((entry) => entry.agent.id === 'sales')?.status).toBe(
      'skipped_no_context',
    );
    expect(verdict.eligible.map((agent) => agent.id)).toContain('finance');
  });

  it('never silently drops an agent — every one is eligible or rejected', () => {
    const verdict = policy.validate([...ORCHESTRATOR_AGENTS], ['ai.agent.run'], RICH_CONTEXT);
    expect(verdict.eligible.length + verdict.rejected.length).toBe(ORCHESTRATOR_AGENTS.length);
  });
});

describe('OrchestratorEngine execution policy', () => {
  let harness: ReturnType<typeof buildEngine>;

  beforeEach(() => {
    harness = buildEngine();
  });

  afterEach(async () => {
    await harness.metricsService.onModuleDestroy();
  });

  it('retries a failing agent up to the attempt budget and then reports the failure', async () => {
    const run = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await harness.engine.execute(fakeAgent('flaky', run), runInput());

    expect(run).toHaveBeenCalledTimes(AGENT_MAX_ATTEMPTS);
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(AGENT_MAX_ATTEMPTS);
    expect(result.failureReason).toContain('boom');
    expect(result.recommendations).toEqual([]);
  });

  it('succeeds on a retry after one transient failure', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(EMPTY_OUTPUT);
    const result = await harness.engine.execute(fakeAgent('recovering', run), runInput());

    expect(result.status).toBe('succeeded');
    expect(result.attempts).toBe(2);
  });

  it('abandons an agent at the timeout without retrying it', async () => {
    jest.useFakeTimers();
    try {
      const run = jest.fn(() => new Promise<AgentOutput>(() => undefined));
      const promise = harness.engine.execute(fakeAgent('hanging', run), runInput());
      await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS + 10);
      const result = await promise;

      expect(result.status).toBe('timed_out');
      expect(run).toHaveBeenCalledTimes(1);
      expect(result.failureReason).toContain('budget');
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the circuit after consecutive failures and short-circuits afterwards', async () => {
    const run = jest.fn().mockRejectedValue(new Error('down'));
    const agent = fakeAgent('breaking', run);

    for (let attempt = 0; attempt < CIRCUIT_FAILURE_THRESHOLD; attempt += 1) {
      await harness.engine.execute(agent, runInput());
    }
    run.mockClear();

    const result = await harness.engine.execute(agent, runInput());
    expect(result.status).toBe('circuit_open');
    expect(run).not.toHaveBeenCalled();
    expect(result.failureReason).toContain('circuit breaker');
  });

  it('half-opens the circuit after the cooldown', () => {
    const breaker = new OrchestratorCircuitBreaker();
    const openedAt = 1_000_000;
    for (let attempt = 0; attempt < CIRCUIT_FAILURE_THRESHOLD; attempt += 1) {
      breaker.recordFailure('agent', openedAt);
    }

    expect(breaker.isOpen('agent', openedAt + 1)).toBe(true);
    expect(breaker.isOpen('agent', openedAt + CIRCUIT_COOLDOWN_MS)).toBe(false);
  });

  it('resets the failure count on success', () => {
    const breaker = new OrchestratorCircuitBreaker();
    breaker.recordFailure('agent');
    breaker.recordFailure('agent');
    breaker.recordSuccess('agent');
    expect(breaker.recordFailure('agent')).toBe(false);
    expect(breaker.isOpen('agent')).toBe(false);
  });

  it('propagates cancellation instead of swallowing it as a failure', async () => {
    const controller = new AbortController();
    controller.abort();
    const agent = fakeAgent('cancelled', () => Promise.resolve(EMPTY_OUTPUT));

    await expect(
      harness.engine.execute(agent, runInput(), controller.signal),
    ).rejects.toBeInstanceOf(OrchestrationCancelledError);
  });

  it('names the agent in its timeout error', () => {
    expect(new AgentTimeoutError('sales').message).toContain('sales');
  });
});

describe('OrchestratorEngine merge, conflicts and consensus', () => {
  let harness: ReturnType<typeof buildEngine>;

  beforeEach(() => {
    harness = buildEngine();
  });

  afterEach(async () => {
    await harness.metricsService.onModuleDestroy();
  });

  async function orchestrate(permissions: string[] = ALL_PERMISSIONS, context = RICH_CONTEXT) {
    const input = runInput({
      context,
      insights: insightsFor(context),
      decisions: decisionsFor(context),
    });
    // A genuinely multi-domain objective, so the domain agents and the
    // cross-domain lenses overlap and can actually disagree.
    const routed = harness.policy.route(
      'Review the entire business: pipeline, revenue, budget, tasks, conversations, customers and compliance.',
    );
    const { eligible, rejected } = harness.policy.validate(routed.agents, permissions, context);
    const parallel = await Promise.all(
      eligible
        .filter((agent) => agent.mode === 'parallel')
        .map((agent) => harness.engine.execute(agent, { ...input, upstream: [] })),
    );
    const sequential: AgentResult[] = [];
    for (const agent of eligible.filter((entry) => entry.mode === 'sequential')) {
      sequential.push(
        await harness.engine.execute(agent, { ...input, upstream: [...parallel, ...sequential] }),
      );
    }
    const agents = [...parallel, ...sequential].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    );
    const skipped = rejected.map((entry) => ({
      agentId: entry.agent.id,
      status: entry.status,
      reason: entry.reason,
    }));
    return { agents, merged: harness.engine.merge(agents, permissions, skipped) };
  }

  it('produces a byte-identical merge across repeated runs', async () => {
    const first = await orchestrate();
    const second = await orchestrate();
    expect(second.merged).toEqual(first.merged);
  });

  it('orders recommendations by decision id then code', async () => {
    const { merged } = await orchestrate();
    const keys = merged.recommendations.map(
      (recommendation) => `${recommendation.decisionId}:${recommendation.code}`,
    );
    expect(keys).toEqual([...keys].sort());
  });

  it('surfaces cross-agent conflicts rather than discarding them', async () => {
    const { merged } = await orchestrate();

    expect(merged.conflicts.length).toBeGreaterThan(0);
    for (const conflict of merged.conflicts) {
      expect(conflict.agentIds).toHaveLength(2);
      expect(conflict.detail.length).toBeGreaterThan(0);
      expect(conflict.resolvedInFavourOf).toBe(conflict.agentIds[0]);
      expect(conflict.resolutionReason).toContain('precedence');
    }
    // The executive lens escalates on critical risk, so it disagrees with
    // the owning domain agent on priority.
    expect(merged.conflicts.some((conflict) => conflict.type === 'priority')).toBe(true);
  });

  it('detects a recommendation conflict and records the loser as rejected', async () => {
    const { merged } = await orchestrate();
    const recommendationConflicts = merged.conflicts.filter(
      (conflict) => conflict.type === 'recommendation',
    );

    expect(recommendationConflicts.length).toBeGreaterThan(0);
    for (const conflict of recommendationConflicts) {
      const loser = conflict.agentIds[1];
      expect(
        merged.consensus.rejectedRecommendations.some(
          (entry) => entry.agentId === loser && entry.decisionId === conflict.decisionId,
        ),
      ).toBe(true);
    }
    for (const rejected of merged.consensus.rejectedRecommendations) {
      expect(rejected.reason).toContain('Superseded by');
    }
  });

  it('detects every conflict dimension the model defines', async () => {
    const { merged } = await orchestrate();
    const types = new Set(merged.conflicts.map((conflict) => conflict.type));
    expect(types.has('priority')).toBe(true);
    expect(types.has('recommendation')).toBe(true);
    expect(types.has('affected_module')).toBe(true);
  });

  it('computes an explainable agreement score', async () => {
    const { merged } = await orchestrate();
    const { consensus } = merged;

    expect(consensus.agreementScore).toBeGreaterThanOrEqual(0);
    expect(consensus.agreementScore).toBeLessThanOrEqual(1);
    expect(consensus.sharedAssessments).toBeGreaterThan(0);
    expect(consensus.agreedAssessments).toBeLessThanOrEqual(consensus.sharedAssessments);
    expect(consensus.agreementScore).toBeCloseTo(
      consensus.agreedAssessments / consensus.sharedAssessments,
      4,
    );
    expect(consensus.explanation).toContain(String(consensus.sharedAssessments));
    const distributionTotal = Object.values(consensus.confidenceDistribution).reduce(
      (total, count) => total + count,
      0,
    );
    expect(distributionTotal).toBe(consensus.participatingAgents.length);
  });

  it('scores perfect agreement when no decision is contested', () => {
    const merged = harness.engine.merge([], ALL_PERMISSIONS, []);
    expect(merged.consensus.agreementScore).toBe(1);
    expect(merged.consensus.sharedAssessments).toBe(0);
    expect(merged.consensus.explanation).toContain('nothing to disagree about');
  });

  it('excludes recommendations the role could not carry out, with the reason', async () => {
    const limited = ALL_PERMISSIONS.filter(
      (permission) => permission !== 'sales.opportunity.update',
    );
    const { merged } = await orchestrate(limited);

    const excluded = merged.consensus.excludedRecommendations;
    expect(excluded.length).toBeGreaterThan(0);
    for (const entry of excluded) {
      expect(entry.missingPermissions.length).toBeGreaterThan(0);
      expect(entry.reason).toContain('cannot carry out');
    }
    expect(
      merged.recommendations.some((recommendation) => recommendation.code === 'review_major_deals'),
    ).toBe(false);
  });

  it('records skipped agents in the consensus instead of hiding them', async () => {
    const { merged } = await orchestrate(['ai.agent.run']);
    expect(merged.consensus.skippedAgents.length).toBeGreaterThan(0);
    for (const skipped of merged.consensus.skippedAgents) {
      expect(skipped.status).toMatch(/^skipped_/);
      expect(skipped.reason.length).toBeGreaterThan(0);
    }
  });

  it('reports failed agents and still merges the survivors', async () => {
    const good = await harness.engine.execute(
      fakeAgent('good', () => Promise.resolve(EMPTY_OUTPUT)),
      runInput(),
    );
    const bad = await harness.engine.execute(
      fakeAgent('bad', () => Promise.reject(new Error('down'))),
      runInput(),
    );
    const merged = harness.engine.merge([good, bad], ALL_PERMISSIONS, []);

    expect(merged.consensus.participatingAgents).toEqual(['good']);
    expect(merged.consensus.failedAgents).toHaveLength(1);
    expect(merged.consensus.failedAgents[0].agentId).toBe('bad');
    expect(merged.consensus.failedAgents[0].status).toBe('failed');
    expect(merged.consensus.failedAgents[0].reason).toContain('down');
  });

  it('never emits an executing recommendation', async () => {
    const { agents, merged } = await orchestrate();
    for (const recommendation of merged.recommendations) {
      expect(recommendation.executes).toBe(false);
    }
    for (const agent of agents) {
      for (const recommendation of agent.recommendations) {
        expect(recommendation.executes).toBe(false);
      }
    }
  });

  it('preserves the approval flag every recommendation arrived with', async () => {
    const { merged } = await orchestrate();
    const decisions = decisionsFor(RICH_CONTEXT);

    expect(merged.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of merged.recommendations) {
      const source = decisions.decisions.find(
        (decision) => decision.id === recommendation.decisionId,
      );
      // Either it mirrors its decision, or it is the compliance agent's
      // access-scope override, which is itself approval-gated.
      if (recommendation.code === 'review_access_scope' && source?.category !== 'compliance') {
        expect(recommendation.requiresApproval).toBe(true);
      } else {
        expect(recommendation.requiresApproval).toBe(source?.approvalRequired);
      }
    }
    expect(merged.approvalRequired).toBe(
      merged.recommendations.some((recommendation) => recommendation.requiresApproval),
    );
  });

  it('never invents a decision, insight or evidence record', async () => {
    const { merged } = await orchestrate();
    const decisions = decisionsFor(RICH_CONTEXT);
    const knownDecisions = new Set(decisions.decisions.map((decision) => decision.id));
    const knownInsights = new Set(
      decisions.decisions.flatMap((decision) => decision.insightIdsUsed),
    );
    const knownEvidence = new Set(
      decisions.decisions.flatMap((decision) => decision.evidence.map((entry) => entry.id)),
    );

    for (const id of merged.decisionIds) expect(knownDecisions.has(id)).toBe(true);
    for (const id of merged.insightIds) expect(knownInsights.has(id)).toBe(true);
    for (const entry of merged.evidence) expect(knownEvidence.has(entry.id)).toBe(true);
    for (const recommendation of merged.recommendations) {
      expect(knownDecisions.has(recommendation.decisionId)).toBe(true);
    }
  });

  it('takes the highest priority and weakest confidence across agents', async () => {
    const { agents, merged } = await orchestrate();
    const succeeded = agents.filter((agent) => agent.status === 'succeeded');
    const weight = { critical: 4, high: 3, medium: 2, low: 1 } as const;

    const highest = succeeded.reduce((max, agent) => Math.max(max, weight[agent.priority]), 0);
    expect(weight[merged.priority]).toBe(highest);

    const confidenceWeight = { high: 3, medium: 2, low: 1 } as const;
    const weakest = succeeded.reduce(
      (min, agent) => Math.min(min, confidenceWeight[agent.confidence]),
      3,
    );
    expect(confidenceWeight[merged.confidence]).toBe(weakest);
  });

  it('bounds merged evidence and de-duplicates it by record id', async () => {
    const { merged } = await orchestrate();
    expect(merged.evidence.length).toBeLessThanOrEqual(20);
    expect(new Set(merged.evidence.map((entry) => entry.id)).size).toBe(merged.evidence.length);
  });

  it('sequences the planning agent after the parallel phase', async () => {
    const { agents } = await orchestrate();
    const planning = agents.find((agent) => agent.agentId === 'planning');

    expect(planning?.mode).toBe('sequential');
    expect(planning?.status).toBe('succeeded');
    // It only sequences what upstream agents actually produced.
    const upstreamIds = new Set(
      agents
        .filter((agent) => agent.mode === 'parallel' && agent.status === 'succeeded')
        .flatMap((agent) => agent.decisionIds),
    );
    for (const id of planning!.decisionIds) expect(upstreamIds.has(id)).toBe(true);
  });

  it('handles an empty context without inventing anything', async () => {
    const empty = buildContext({
      metadata: {
        sourcesIncluded: [],
        excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
      } as unknown as ExecutiveContext['metadata'],
    });
    const { merged } = await orchestrate(ALL_PERMISSIONS, empty);

    expect(merged.recommendations).toEqual([]);
    expect(merged.evidence).toEqual([]);
    expect(merged.conflicts).toEqual([]);
    expect(merged.approvalRequired).toBe(false);
  });
});

describe('OrchestratorMetrics', () => {
  it('registers every collector once with closed label sets', async () => {
    const metricsService = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
    const metrics = new OrchestratorMetrics(metricsService);

    metrics.recordRequest('success');
    metrics.recordDuration(120);
    metrics.recordAgentExecution('sales', 'succeeded', 5);
    metrics.recordExecutionMode('parallel', 6);
    metrics.recordExecutionMode('sequential', 1);
    metrics.recordConsensus(0.8);
    metrics.recordConflict('priority');
    metrics.recordMergeDuration(2);
    metrics.recordPartialFailure();
    metrics.recordTimeout('finance');
    metrics.recordRetry('finance');
    metrics.recordCircuitOpen('finance');
    metrics.recordConfidence('high');

    const output = await metricsService.getMetrics();
    expect(output).toContain('voltx_orchestrator_requests_total{result="success"} 1');
    expect(output).toContain('voltx_orchestrator_duration_seconds_count 1');
    expect(output).toContain(
      'voltx_orchestrator_agent_executions_total{agent="sales",status="succeeded"} 1',
    );
    expect(output).toContain('voltx_orchestrator_executions_by_mode_total{mode="parallel"} 6');
    expect(output).toContain('voltx_orchestrator_executions_by_mode_total{mode="sequential"} 1');
    expect(output).toContain('voltx_orchestrator_consensus_total{bucket="0.75"} 1');
    expect(output).toContain('voltx_orchestrator_conflicts_total{type="priority"} 1');
    expect(output).toContain('voltx_orchestrator_merge_duration_seconds_count 1');
    expect(output).toContain('voltx_orchestrator_partial_failures_total 1');
    expect(output).toContain('voltx_orchestrator_agent_timeouts_total{agent="finance"} 1');
    expect(output).toContain('voltx_orchestrator_agent_retries_total{agent="finance"} 1');
    expect(output).toContain('voltx_orchestrator_circuit_open_total{agent="finance"} 1');
    expect(output.match(/^# HELP voltx_orchestrator_requests_total /gm) ?? []).toHaveLength(1);

    await metricsService.onModuleDestroy();
  });

  it('buckets consensus onto a fixed five-value scale', async () => {
    const metricsService = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
    const metrics = new OrchestratorMetrics(metricsService);
    for (const score of [0, 0.3, 0.6, 0.9, 1]) metrics.recordConsensus(score);

    const output = await metricsService.getMetrics();
    const buckets = [...output.matchAll(/voltx_orchestrator_consensus_total\{bucket="([^"]+)"\}/g)]
      .map((match) => match[1])
      .sort();
    expect(buckets).toEqual(['0.0', '0.25', '0.5', '0.75', '1.0']);

    await metricsService.onModuleDestroy();
  });

  it('never labels a metric with tenant, user, objective or record data', async () => {
    const metricsService = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
    const metrics = new OrchestratorMetrics(metricsService);
    metrics.recordRequest('success');
    metrics.recordAgentExecution('sales', 'succeeded', 1);
    metrics.recordConflict('priority');
    metrics.recordConsensus(1);

    const allowed = new Set([
      'result',
      'agent',
      'status',
      'mode',
      'bucket',
      'type',
      'confidence',
      'le',
    ]);
    const knownAgents = new Set([...ORCHESTRATOR_AGENTS.map((agent) => agent.id), 'finance']);
    const output = await metricsService.getMetrics();

    for (const line of output
      .split('\n')
      .filter((entry) => entry.startsWith('voltx_orchestrator_'))) {
      const labels = /\{([^}]*)\}/.exec(line)?.[1] ?? '';
      for (const pair of labels.split(',').filter(Boolean)) {
        const [name, rawValue] = pair.split('=');
        expect(allowed.has(name.trim())).toBe(true);
        if (name.trim() === 'agent') {
          expect(knownAgents.has(rawValue.replaceAll('"', ''))).toBe(true);
        }
      }
      expect(line).not.toContain('tenant-1');
      expect(line).not.toContain('user-1');
      expect(line).not.toContain('opportunity:');
    }

    await metricsService.onModuleDestroy();
  });
});

describe('capability coverage', () => {
  it('has at least one agent for every declared capability', () => {
    const registry = new OrchestratorRegistry();
    const capabilities: AgentCapability[] = [
      'executive_summary',
      'pipeline_analysis',
      'revenue_analysis',
      'budget_analysis',
      'operations_analysis',
      'communications_analysis',
      'customer_health_analysis',
      'compliance_review',
      'action_planning',
    ];
    for (const capability of capabilities) {
      expect(registry.byCapability(capability).length).toBeGreaterThan(0);
    }
  });
});
