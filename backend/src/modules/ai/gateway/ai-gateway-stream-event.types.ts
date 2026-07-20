import { AIStreamEvent } from '../models/ai-model.types';
import { ToolGrounding } from '../tools/tool-result.types';

/**
 * Coarse lifecycle status of a streamed AI turn (conversation message or
 * agent run). Distinct from AIStreamEvent's `message_end`/`error`, which
 * describe the underlying model call only.
 */
export type AiRunStatus =
  'queued' | 'processing' | 'streaming' | 'completed' | 'cancelled' | 'failed';

/**
 * Fixed, non-chain-of-thought progress labels. These describe *what phase*
 * of the turn is executing, never the model's actual reasoning content.
 */
export type AiReasoningStage = 'planning' | 'executing_tool' | 'finalizing';

/**
 * A concise, non-chain-of-thought summary of what an autonomous loop
 * iteration decided to do next.
 */
export type AiAgentDecisionKind =
  'continue_with_tool' | 'final_answer' | 'delegate' | 'delegate_parallel';

/**
 * Events a streaming conversation turn or agent run can emit, layered
 * alongside (not replacing) the existing AIStreamEvent contract that
 * providers and the unchanged /ai/chat endpoint already use. `provider_event`
 * wraps an AIStreamEvent unchanged so token deltas keep their existing wire
 * shape on the new endpoints too.
 *
 * `plan`/`step_started`/`decision`/`next_step` are additive, used only by
 * the Phase 1 autonomous agent loop — single-turn chat/agent-run streaming
 * (VT-020) never emits them.
 */
export type AiGatewayStreamEvent =
  | { type: 'status'; status: AiRunStatus }
  | { type: 'reasoning'; stage: AiReasoningStage; message: string }
  | { type: 'tool_call_start'; toolName: string }
  | { type: 'tool_call_result'; toolName: string; durationMs: number; grounding?: ToolGrounding }
  | { type: 'tool_call_error'; toolName: string; message: string }
  | { type: 'provider_event'; event: AIStreamEvent }
  | { type: 'plan'; objective: string; steps: string[] }
  | { type: 'step_started'; stepNumber: number }
  | { type: 'decision'; stepNumber: number; decision: AiAgentDecisionKind; toolName?: string }
  | { type: 'next_step'; stepNumber: number }
  | { type: 'run_paused_for_approval'; approvalId: string; toolName: string };
