export type WorkflowStreamEvent =
  | { type: 'workflow_started'; workflowRunId: string }
  | { type: 'step_started'; workflowRunId: string; stepId: string }
  | { type: 'step_completed'; workflowRunId: string; stepId: string }
  | { type: 'step_skipped'; workflowRunId: string; stepId: string }
  | { type: 'step_retrying'; workflowRunId: string; stepId: string; attempt: number }
  | { type: 'step_waiting_approval'; workflowRunId: string; stepId: string }
  | { type: 'step_failed'; workflowRunId: string; stepId: string; error: string }
  | { type: 'workflow_paused'; workflowRunId: string }
  | { type: 'workflow_resumed'; workflowRunId: string }
  | { type: 'workflow_cancelled'; workflowRunId: string }
  | { type: 'workflow_completed'; workflowRunId: string }
  | { type: 'workflow_failed'; workflowRunId: string; error: string };
