export type WorkflowStepType =
  'AGENT' | 'TOOL' | 'API' | 'WEBHOOK' | 'NOTIFICATION' | 'APPROVAL' | 'DELAY' | 'INTEGRATION';

/**
 * A gate evaluated before a step runs, against the accumulated
 * {input, context} of the run so far (context is keyed by stepId — see
 * WorkflowRun.context). A false condition SKIPs the step (and its
 * dependents that have no other path) rather than failing the run —
 * conditional branching is "does this branch run at all," not an error
 * path. Kept as one flat comparison rather than a boolean expression tree:
 * the vast majority of workflow conditions are "did the previous step
 * decide X," and a tree adds real complexity for a case that barely
 * exists in practice.
 */
export interface StepCondition {
  /** Dot path evaluated against `{ input, context }`, e.g. "context.check_deal.approved". */
  path: string;
  operator: 'eq' | 'neq' | 'exists' | 'not_exists' | 'truthy' | 'falsy' | 'gt' | 'lt' | 'contains';
  value?: unknown;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
}

/** What to do if this step's own output must be undone after a later step fails. */
export interface CompensationConfig {
  toolName: string;
  input: Record<string, unknown>;
}

interface BaseStepDefinition {
  id: string;
  name: string;
  /** Step ids that must reach a terminal state before this one starts — the edges of the DAG. */
  dependsOn?: string[];
  condition?: StepCondition;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  compensation?: CompensationConfig;
}

export interface AgentStepConfig {
  agentName: string;
  objective: string;
  workspaceContext?: string[];
  maxIterations?: number;
  maxToolCalls?: number;
}

export interface ToolStepConfig {
  toolName: string;
  input: Record<string, unknown>;
}

export interface ApiStepConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface WebhookStepConfig {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface NotificationStepConfig {
  channel: 'log' | 'webhook';
  message: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalStepConfig {
  message: string;
  approverRole?: string;
  timeoutMs?: number;
}

export interface DelayStepConfig {
  delayMs: number;
}

/**
 * `provider`/`actionName` are intentionally plain strings rather than a
 * shared literal union — validating them against the real integration
 * provider/action catalog happens at runtime (IntegrationStepExecutor),
 * the same loose-typing-plus-runtime-validation approach ToolStepConfig
 * already uses for `toolName`. Keeps the workflow engine's type layer
 * free of a hard dependency on the integrations module.
 */
export interface IntegrationStepConfig {
  provider: string;
  actionName: string;
  connectionId?: string;
  input: Record<string, unknown>;
}

export type AgentStepDefinition = BaseStepDefinition & { type: 'AGENT'; config: AgentStepConfig };
export type ToolStepDefinition = BaseStepDefinition & { type: 'TOOL'; config: ToolStepConfig };
export type ApiStepDefinition = BaseStepDefinition & { type: 'API'; config: ApiStepConfig };
export type WebhookStepDefinition = BaseStepDefinition & {
  type: 'WEBHOOK';
  config: WebhookStepConfig;
};
export type NotificationStepDefinition = BaseStepDefinition & {
  type: 'NOTIFICATION';
  config: NotificationStepConfig;
};
export type ApprovalStepDefinition = BaseStepDefinition & {
  type: 'APPROVAL';
  config: ApprovalStepConfig;
};
export type DelayStepDefinition = BaseStepDefinition & { type: 'DELAY'; config: DelayStepConfig };
export type IntegrationStepDefinition = BaseStepDefinition & {
  type: 'INTEGRATION';
  config: IntegrationStepConfig;
};

export type WorkflowStepDefinition =
  | AgentStepDefinition
  | ToolStepDefinition
  | ApiStepDefinition
  | WebhookStepDefinition
  | NotificationStepDefinition
  | ApprovalStepDefinition
  | DelayStepDefinition
  | IntegrationStepDefinition;

/**
 * The full executable graph persisted as one WorkflowVersion.definition.
 * Parallel branches are not a separate step type — any set of steps whose
 * `dependsOn` don't chain them together are, by construction, eligible to
 * run concurrently; the engine's scheduler discovers this from the graph
 * shape rather than the definition declaring "this is a parallel block."
 */
export interface WorkflowDefinition {
  steps: WorkflowStepDefinition[];
  defaultRetryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
}
