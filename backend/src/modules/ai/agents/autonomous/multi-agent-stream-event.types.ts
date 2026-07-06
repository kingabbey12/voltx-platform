import { AiGatewayStreamEvent } from '../../gateway/ai-gateway-stream-event.types';

/**
 * Coordinator/delegation-level events, additive alongside the existing
 * single-agent AiGatewayStreamEvent union from VT-020/VT-021 — those event
 * types are untouched and keep flowing unwrapped for the root agent's own
 * reasoning/tool activity. `agent_event` wraps a delegated child's own
 * (otherwise-identical) event stream with which node in the execution tree
 * it belongs to, so a client can attribute events without the loop or
 * gateway needing to know about the tree at all.
 */
export type MultiAgentStreamEvent =
  | { type: 'coordinator_started'; rootRunId: string; objective: string }
  | {
      type: 'agent_spawned';
      agentRunId: string;
      agentName: string;
      parentRunId: string;
      depth: number;
    }
  | { type: 'agent_working'; agentRunId: string; agentName: string }
  | { type: 'agent_waiting'; agentRunId: string; agentName: string; waitingOnAgentRunId: string }
  | { type: 'agent_completed'; agentRunId: string; agentName: string; succeeded: boolean }
  | {
      type: 'delegation';
      fromAgentRunId: string;
      toAgentName: string;
      objective: string;
    }
  | { type: 'aggregation'; agentRunId: string; childAgentRunIds: string[] }
  | { type: 'coordinator_finished'; rootRunId: string; outputText: string }
  | {
      type: 'agent_event';
      agentRunId: string;
      agentName: string;
      parentRunId: string | null;
      depth: number;
      // Recursive: a delegated agent's own delegated children arrive as
      // agent_event too, nested one level deeper each time.
      event: AiGatewayStreamEvent | MultiAgentStreamEvent;
    };
