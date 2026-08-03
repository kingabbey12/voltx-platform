import { Injectable } from '@nestjs/common';
import { ExecutiveContext } from '../context/context.types';
import { OrchestratorRegistry } from './orchestrator.registry';
import { AgentCapability, AgentInterface, AgentExecutionStatus } from './orchestrator.types';

/** Hard ceiling on one agent's run. Agents are pure, so this only ever
 * fires on a pathological input or a future async agent. */
export const AGENT_TIMEOUT_MS = 5_000;
/** Total attempts per agent: one initial call plus one retry. */
export const AGENT_MAX_ATTEMPTS = 2;
/** Consecutive failures before an agent's breaker opens. */
export const CIRCUIT_FAILURE_THRESHOLD = 3;
/** How long a breaker stays open before a probe is allowed through. */
export const CIRCUIT_COOLDOWN_MS = 30_000;

/**
 * Deterministic routing table. Terms are matched as whole words against the
 * lower-cased objective — no model, no embedding, no ranking heuristic, so
 * the same objective always selects the same agents.
 */
export const CAPABILITY_TERMS: ReadonlyArray<{
  capability: AgentCapability;
  terms: readonly string[];
}> = [
  {
    capability: 'pipeline_analysis',
    terms: ['pipeline', 'deal', 'deals', 'sales', 'opportunity', 'opportunities', 'quota'],
  },
  {
    capability: 'revenue_analysis',
    terms: ['revenue', 'finance', 'financial', 'invoice', 'invoices', 'cash', 'income'],
  },
  { capability: 'budget_analysis', terms: ['budget', 'budgets', 'spend', 'spending', 'cost'] },
  {
    capability: 'operations_analysis',
    terms: ['operations', 'operational', 'task', 'tasks', 'workflow', 'workflows', 'backlog'],
  },
  {
    capability: 'communications_analysis',
    terms: ['communication', 'communications', 'conversation', 'conversations', 'inbox', 'message'],
  },
  {
    capability: 'customer_health_analysis',
    terms: ['customer', 'customers', 'client', 'clients', 'churn', 'escalation', 'support'],
  },
  {
    capability: 'compliance_review',
    terms: ['compliance', 'governance', 'audit', 'policy', 'access', 'regulatory'],
  },
  {
    capability: 'executive_summary',
    terms: [
      'executive',
      'business',
      'company',
      'overall',
      'everything',
      'priorities',
      'priority',
      'today',
      'risk',
      'risks',
      'review',
      'summarize',
      'summary',
      'coordinate',
    ],
  },
  { capability: 'action_planning', terms: ['plan', 'planning', 'next', 'roadmap', 'sequence'] },
];

/** Used when an objective matches no term at all. Selecting
 * executive_summary here also triggers the broad-review expansion below,
 * so an unrecognised objective engages every agent rather than none. */
export const FALLBACK_CAPABILITIES: readonly AgentCapability[] = [
  'executive_summary',
  'action_planning',
];

export interface RoutingDecision {
  capabilities: AgentCapability[];
  matchedTerms: string[];
  rule: string;
  agents: AgentInterface[];
}

export interface PermissionVerdict {
  eligible: AgentInterface[];
  rejected: Array<{ agent: AgentInterface; status: AgentExecutionStatus; reason: string }>;
}

/** Whole-word tokens, punctuation stripped. Bounded to avoid pathological input. */
export function tokenize(objective: string): string[] {
  return objective
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 200);
}

@Injectable()
export class OrchestratorPolicy {
  constructor(private readonly registry: OrchestratorRegistry) {}

  /**
   * Capability selection. Every matching capability contributes its agents;
   * PlanningAgent is always appended so a multi-agent run is always
   * sequenced, and results are ordered by registry precedence.
   */
  route(objective: string): RoutingDecision {
    const tokens = new Set(tokenize(objective));
    const matchedTerms: string[] = [];
    const capabilities: AgentCapability[] = [];

    for (const { capability, terms } of CAPABILITY_TERMS) {
      const hits = terms.filter((term) => tokens.has(term));
      if (hits.length > 0) {
        capabilities.push(capability);
        matchedTerms.push(...hits);
      }
    }

    const matched = capabilities.length > 0;
    const selected = matched ? [...capabilities] : [...FALLBACK_CAPABILITIES];

    // A broad-review term ("review the entire business", "what should my
    // company do today") is a request for every domain, not just the
    // executive lens — so executive_summary expands to the full capability
    // set. A narrow objective ("how is the pipeline?") never does, which is
    // what keeps single-agent runs single-agent.
    const broad = selected.includes('executive_summary');
    if (broad) {
      for (const { capability } of CAPABILITY_TERMS) {
        if (!selected.includes(capability)) selected.push(capability);
      }
    }
    if (!selected.includes('action_planning')) selected.push('action_planning');

    const agents = this.registry
      .list()
      .filter((agent) =>
        agent.supportedCapabilities.some((capability) => selected.includes(capability)),
      );

    return {
      capabilities: [...new Set(selected)].sort(),
      matchedTerms: [...new Set(matchedTerms)].sort(),
      rule: matched ? (broad ? 'term_match_broad_review' : 'term_match') : 'fallback_broad_review',
      agents,
    };
  }

  /**
   * Permission and context validation. An agent runs only when the caller
   * holds at least one of its required permissions and at least one of its
   * context sources survived permission filtering. Rejections are returned,
   * never dropped.
   */
  validate(
    agents: readonly AgentInterface[],
    permissions: readonly string[],
    context: ExecutiveContext,
  ): PermissionVerdict {
    const held = new Set(permissions);
    const included = new Set(context.metadata.sourcesIncluded);
    const eligible: AgentInterface[] = [];
    const rejected: PermissionVerdict['rejected'] = [];

    for (const agent of agents) {
      if (!agent.requiredPermissions.some((permission) => held.has(permission))) {
        rejected.push({
          agent,
          status: 'skipped_permission',
          reason: 'The role does not hold any permission this agent requires.',
        });
        continue;
      }
      if (!agent.supportedContextSources.some((source) => included.has(source))) {
        rejected.push({
          agent,
          status: 'skipped_no_context',
          reason: 'No context source this agent reads is available to the role.',
        });
        continue;
      }
      eligible.push(agent);
    }

    return { eligible, rejected };
  }
}

interface BreakerState {
  consecutiveFailures: number;
  openedAt: number | null;
}

/**
 * Per-agent circuit breaker, in-process and per-replica by design: it
 * protects this instance's request latency, and a shared breaker would need
 * distributed state for no added safety here.
 */
@Injectable()
export class OrchestratorCircuitBreaker {
  private readonly states = new Map<string, BreakerState>();

  isOpen(agentId: string, now: number = Date.now()): boolean {
    const state = this.states.get(agentId);
    if (!state?.openedAt) return false;
    if (now - state.openedAt >= CIRCUIT_COOLDOWN_MS) {
      // Half-open: allow one probe through and reset the counter.
      state.openedAt = null;
      state.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(agentId: string): void {
    this.states.set(agentId, { consecutiveFailures: 0, openedAt: null });
  }

  /** Returns true when this failure opened the breaker. */
  recordFailure(agentId: string, now: number = Date.now()): boolean {
    const state = this.states.get(agentId) ?? { consecutiveFailures: 0, openedAt: null };
    state.consecutiveFailures += 1;
    const opened = state.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && !state.openedAt;
    if (opened) state.openedAt = now;
    this.states.set(agentId, state);
    return opened;
  }

  reset(): void {
    this.states.clear();
  }
}
