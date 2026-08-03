import { Injectable } from '@nestjs/common';
import { ExecutiveContextItem, ExecutiveContextSource } from '../context/context.types';
import { DecisionCategory, ExecutiveDecision } from '../decision/decision.types';
import {
  AgentAssessment,
  AgentCapability,
  AgentConfidence,
  AgentInterface,
  AgentOutput,
  AgentPriority,
  AgentRecommendation,
  AgentRunInput,
} from './orchestrator.types';

export const AGENT_VERSION = '1.0';

const PRIORITY_WEIGHT: Record<AgentPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const CONFIDENCE_WEIGHT: Record<AgentConfidence, number> = { high: 3, medium: 2, low: 1 };

/** Evidence carried by one agent, bounded so output stays predictable. */
const MAX_AGENT_EVIDENCE = 5;
/** Decisions the cross-domain executive lens considers. */
const MAX_EXECUTIVE_DECISIONS = 6;

function highestImpact(decisions: readonly ExecutiveDecision[]): AgentPriority {
  return decisions.reduce<AgentPriority>(
    (highest, decision) =>
      PRIORITY_WEIGHT[decision.businessImpact] > PRIORITY_WEIGHT[highest]
        ? decision.businessImpact
        : highest,
    'low',
  );
}

/** The weakest confidence of the decisions the agent relied on. */
function weakestConfidence(decisions: readonly ExecutiveDecision[]): AgentConfidence {
  if (decisions.length === 0) return 'low';
  return decisions.reduce<AgentConfidence>(
    (lowest, decision) =>
      CONFIDENCE_WEIGHT[decision.confidence] < CONFIDENCE_WEIGHT[lowest]
        ? decision.confidence
        : lowest,
    'high',
  );
}

function rankEvidence(decisions: readonly ExecutiveDecision[]): ExecutiveContextItem[] {
  const unique = new Map<string, ExecutiveContextItem>();
  for (const decision of decisions) {
    for (const item of decision.evidence) if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()]
    .sort(
      (left, right) =>
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_AGENT_EVIDENCE);
}

function recommendationsFrom(decisions: readonly ExecutiveDecision[]): AgentRecommendation[] {
  return decisions
    .map((decision) => ({
      code: decision.recommendedAction.code,
      label: decision.recommendedAction.label,
      decisionId: decision.id,
      requiredPermissions: decision.requiredPermissions,
      requiresApproval: decision.approvalRequired,
      executes: false as const,
    }))
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
}

function assessmentsFrom(
  decisions: readonly ExecutiveDecision[],
  lens?: (decision: ExecutiveDecision) => Partial<AgentAssessment>,
): AgentAssessment[] {
  return decisions
    .map((decision) => ({
      decisionId: decision.id,
      priority: decision.priority,
      confidence: decision.confidence,
      recommendationCode: decision.recommendedAction.code,
      affectedModule: decision.contextSourcesUsed[0] ?? 'cross_domain',
      requiredPermissions: decision.requiredPermissions,
      evidenceIds: decision.evidence.map((item) => item.id).sort(),
      ...(lens ? lens(decision) : {}),
    }))
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
}

function outputFor(
  decisions: readonly ExecutiveDecision[],
  summary: string,
  sources: readonly ExecutiveContextSource[],
  lens?: (decision: ExecutiveDecision) => Partial<AgentAssessment>,
): AgentOutput {
  const assessments = assessmentsFrom(decisions, lens);
  return {
    summary,
    assessments,
    recommendations: recommendationsFrom(decisions),
    evidence: rankEvidence(decisions),
    decisionIds: decisions.map((decision) => decision.id).sort(),
    insightIds: [...new Set(decisions.flatMap((decision) => decision.insightIdsUsed))].sort(),
    confidence: weakestConfidence(decisions),
    businessImpact: highestImpact(decisions),
    priority: assessments.reduce<AgentPriority>(
      (highest, assessment) =>
        PRIORITY_WEIGHT[assessment.priority] > PRIORITY_WEIGHT[highest]
          ? assessment.priority
          : highest,
      'low',
    ),
    sourcesUsed: [...new Set(decisions.flatMap((decision) => decision.contextSourcesUsed))].sort(),
  };
}

function byCategory(input: AgentRunInput, ...categories: DecisionCategory[]): ExecutiveDecision[] {
  const wanted = new Set<DecisionCategory>(categories);
  return input.decisions.decisions.filter((decision) => wanted.has(decision.category));
}

/**
 * A domain agent: it takes the Decision Engine's output for its own
 * categories and reports it verbatim. It adds a domain summary and nothing
 * else — no rule is re-derived here, which is what keeps the Decision
 * Engine the single source of business logic.
 */
class DomainAgent implements AgentInterface {
  readonly version = AGENT_VERSION;
  readonly mode = 'parallel' as const;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly supportedCapabilities: readonly AgentCapability[],
    readonly requiredPermissions: readonly string[],
    readonly supportedContextSources: readonly ExecutiveContextSource[],
    private readonly categories: DecisionCategory[],
    private readonly noun: string,
  ) {}

  run(input: AgentRunInput): Promise<AgentOutput> {
    const decisions = byCategory(input, ...this.categories);
    const summary = decisions.length
      ? `${decisions.length} ${this.noun} decision(s) derived from permitted context.`
      : `No ${this.noun} decisions are available from the permitted context.`;
    return Promise.resolve(outputFor(decisions, summary, this.supportedContextSources));
  }
}

/**
 * Cross-domain lens. A domain agent judges each decision on its own; the
 * executive view judges concentration — when one business area produces
 * more than one decision, that reads as systemic rather than incidental,
 * so the executive raises those to critical. This is precisely where it
 * legitimately disagrees with the owning domain agent, and the
 * orchestrator surfaces that as a conflict rather than hiding it.
 */
class ExecutiveAgent implements AgentInterface {
  readonly id = 'executive';
  readonly name = 'ExecutiveAgent';
  readonly version = AGENT_VERSION;
  readonly mode = 'parallel' as const;
  readonly supportedCapabilities = ['executive_summary'] as const;
  readonly requiredPermissions = ['ai.agent.run'] as const;
  readonly supportedContextSources = ['crm', 'finance', 'operations', 'communications'] as const;

  run(input: AgentRunInput): Promise<AgentOutput> {
    const decisions = input.decisions.decisions.slice(0, MAX_EXECUTIVE_DECISIONS);
    const perModule = new Map<string, number>();
    for (const decision of decisions) {
      const module = decision.contextSourcesUsed[0] ?? 'cross_domain';
      perModule.set(module, (perModule.get(module) ?? 0) + 1);
    }
    const systemic = (decision: ExecutiveDecision): boolean =>
      (perModule.get(decision.contextSourcesUsed[0] ?? 'cross_domain') ?? 0) > 1;
    const escalated = decisions.filter(systemic).length;
    const summary = decisions.length
      ? `${decisions.length} decision(s) reviewed across every permitted domain; ${escalated} sit in an area with more than one open decision.`
      : 'No decisions are available from the permitted context.';
    return Promise.resolve(
      outputFor(decisions, summary, this.supportedContextSources, (decision) => ({
        priority: systemic(decision) ? 'critical' : decision.priority,
        affectedModule: 'cross_domain',
      })),
    );
  }
}

/**
 * Governance lens. It owns compliance decisions and additionally reviews
 * any decision whose explainability records a permission limitation, where
 * it recommends reviewing access scope instead of the domain action — a
 * deliberate, deterministic recommendation conflict.
 */
class ComplianceAgent implements AgentInterface {
  readonly id = 'compliance';
  readonly name = 'ComplianceAgent';
  readonly version = AGENT_VERSION;
  readonly mode = 'parallel' as const;
  readonly supportedCapabilities = ['compliance_review'] as const;
  readonly requiredPermissions = ['ai.agent.run'] as const;
  readonly supportedContextSources = ['crm', 'finance', 'operations', 'communications'] as const;

  run(input: AgentRunInput): Promise<AgentOutput> {
    const own = byCategory(input, 'compliance');
    const restricted = input.decisions.decisions.filter(
      (decision) =>
        decision.category !== 'compliance' &&
        decision.explainability.permissionLimitations.length > 0,
    );
    const decisions = [...own, ...restricted];
    const summary = decisions.length
      ? `${own.length} compliance decision(s) and ${restricted.length} decision(s) taken under restricted visibility.`
      : 'No compliance concerns are visible in the permitted context.';

    const output = outputFor(decisions, summary, this.supportedContextSources, (decision) =>
      decision.category === 'compliance'
        ? {}
        : { recommendationCode: 'review_access_scope', affectedModule: 'cross_domain' },
    );
    return Promise.resolve({
      ...output,
      recommendations: output.recommendations.map((recommendation) =>
        own.some((decision) => decision.id === recommendation.decisionId)
          ? recommendation
          : {
              ...recommendation,
              code: 'review_access_scope',
              label: 'Review the access scope before acting on this decision',
              requiredPermissions: ['role.read', 'permission.read'],
              requiresApproval: true,
            },
      ),
    });
  }
}

/**
 * Sequential planner. It runs after the parallel phase and sequences what
 * the other agents produced — it reads their results rather than the
 * decision set, which is the delegation edge in the execution graph.
 */
class PlanningAgent implements AgentInterface {
  readonly id = 'planning';
  readonly name = 'PlanningAgent';
  readonly version = AGENT_VERSION;
  readonly mode = 'sequential' as const;
  readonly supportedCapabilities = ['action_planning'] as const;
  readonly requiredPermissions = ['ai.agent.run'] as const;
  readonly supportedContextSources = ['crm', 'finance', 'operations', 'communications'] as const;

  run(input: AgentRunInput): Promise<AgentOutput> {
    const upstream = input.upstream.filter((result) => result.status === 'succeeded');
    const decisionIds = [...new Set(upstream.flatMap((result) => result.decisionIds))].sort();
    const decisions = input.decisions.decisions.filter((decision) =>
      decisionIds.includes(decision.id),
    );
    const ordered = [...decisions].sort(
      (left, right) =>
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
        left.id.localeCompare(right.id),
    );
    const summary = ordered.length
      ? `Sequenced ${ordered.length} decision(s) from ${upstream.length} upstream agent(s); start with ${ordered[0].title}.`
      : 'No upstream agent produced a decision to sequence.';
    return Promise.resolve(outputFor(ordered, summary, this.supportedContextSources));
  }
}

export const ORCHESTRATOR_AGENTS: readonly AgentInterface[] = [
  // Registry order is precedence order: earlier agents win merge conflicts.
  new ExecutiveAgent(),
  new DomainAgent(
    'sales',
    'SalesAgent',
    ['pipeline_analysis'],
    ['sales.opportunity.read', 'sales.lead.read'],
    ['crm'],
    ['sales'],
    'sales',
  ),
  new DomainAgent(
    'finance',
    'FinanceAgent',
    ['revenue_analysis', 'budget_analysis'],
    ['finance.transaction.read', 'finance.budget.read'],
    ['finance'],
    ['finance'],
    'finance',
  ),
  new DomainAgent(
    'operations',
    'OperationsAgent',
    ['operations_analysis'],
    ['sales.activity.read', 'workflow.read'],
    ['operations'],
    ['operations'],
    'operations',
  ),
  new DomainAgent(
    'communications',
    'CommunicationsAgent',
    ['communications_analysis'],
    ['communications.conversation.read'],
    ['communications'],
    ['communications'],
    'communications',
  ),
  new DomainAgent(
    'customer_success',
    'CustomerSuccessAgent',
    ['customer_health_analysis'],
    ['communications.conversation.read'],
    ['communications'],
    ['customer_success'],
    'customer success',
  ),
  new ComplianceAgent(),
  new PlanningAgent(),
];

@Injectable()
export class OrchestratorRegistry {
  private readonly agents = new Map(ORCHESTRATOR_AGENTS.map((agent) => [agent.id, agent]));

  /** Registry order — deterministic and also the conflict precedence order. */
  list(): readonly AgentInterface[] {
    return ORCHESTRATOR_AGENTS;
  }

  get(id: string): AgentInterface | undefined {
    return this.agents.get(id);
  }

  /** Lower is higher precedence. Unknown agents sort last, stably. */
  precedenceOf(id: string): number {
    const index = ORCHESTRATOR_AGENTS.findIndex((agent) => agent.id === id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  byCapability(capability: AgentCapability): readonly AgentInterface[] {
    return ORCHESTRATOR_AGENTS.filter((agent) => agent.supportedCapabilities.includes(capability));
  }
}
