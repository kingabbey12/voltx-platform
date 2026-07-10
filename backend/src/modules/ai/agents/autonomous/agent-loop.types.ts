import { MessageResponseDto } from '../../conversations/dto/conversation.dto';
import { ToolResult } from '../../tools/tool-result.types';
import { CoordinationState } from './coordination-state';
import { AgentPlan } from './agent-plan.types';

export interface AgentLoopInput {
  objective: string;
  workspaceContext?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  maxIterations?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
  /**
   * Shared multi-agent coordination budget (agent count/depth/deadline).
   * Absent means this loop cannot delegate — a model-requested delegation
   * without a coordination state is reported back as an unavailable
   * capability rather than crashing the run.
   */
  coordinationState?: CoordinationState;
}

export type AgentLoopStopReason =
  'final_answer' | 'max_iterations' | 'max_tool_calls' | 'timeout' | 'waiting_approval';

export interface AgentLoopResult {
  outputText: string;
  iterations: number;
  toolCallCount: number;
  stoppedReason: AgentLoopStopReason;
  tokenUsage: Record<string, unknown>;
  userMessage: MessageResponseDto;
  toolMessages: MessageResponseDto[];
  assistantMessage: MessageResponseDto | null;
  toolResults: ToolResult[];
  plan: AgentPlan;
  /** Set only when stoppedReason is 'waiting_approval' — the AgentActionApproval id the run is paused on. */
  pendingApprovalId?: string;
}
