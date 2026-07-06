import { WorkflowStepDefinition, WorkflowStepType } from '../definition/workflow-definition.types';

export interface StepExecutionContext {
  organizationId: string;
  workflowRunId: string;
  stepRunId: string;
  conversationId: string;
  /** Accumulated {input, context} available for interpolation/reference by step config. */
  runInput: Record<string, unknown>;
  runContext: Record<string, unknown>;
  grantedPermissions: string[];
  signal?: AbortSignal;
}

export interface StepExecutionResult {
  output: Record<string, unknown>;
  /**
   * True only for an APPROVAL step still pending a decision — the engine
   * stops advancing the run (WAITING_APPROVAL) instead of treating this as
   * completion. No other step type ever sets this.
   */
  waiting?: boolean;
}

/**
 * One implementation per WorkflowStepType. Each executor reuses an
 * existing subsystem end to end (AgentService for AGENT, AIGatewayService
 * for TOOL) rather than reimplementing execution — the workflow engine's
 * job is orchestration (DAG scheduling, retries, checkpoints), not a
 * second copy of "how do I run an agent."
 */
export interface StepExecutor {
  readonly type: WorkflowStepType;
  execute(
    step: WorkflowStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult>;
}
