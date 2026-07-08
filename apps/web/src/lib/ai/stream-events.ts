/**
 * Frontend mirror of the backend's AiGatewayStreamEvent union
 * (backend/src/modules/ai/gateway/ai-gateway-stream-event.types.ts) —
 * the exact event names/shapes the run/autonomous/stream endpoint emits
 * as SSE frames.
 */
export type AiRunStatus = "queued" | "processing" | "streaming" | "completed" | "cancelled" | "failed";

export type AgentStreamEvent =
  | { type: "coordinator_started"; rootRunId: string; objective: string }
  | { type: "status"; status: AiRunStatus }
  | { type: "reasoning"; stage: "planning" | "executing_tool" | "finalizing"; message: string }
  | { type: "tool_call_start"; toolName: string }
  | { type: "tool_call_result"; toolName: string; durationMs: number }
  | { type: "tool_call_error"; toolName: string; message: string }
  | { type: "content_delta"; delta: string }
  | { type: "message_end"; finishReason?: string; outputText?: string }
  | { type: "plan"; objective: string; steps: string[] }
  | { type: "step_started"; stepNumber: number }
  | {
      type: "decision";
      stepNumber: number;
      decision: "continue_with_tool" | "final_answer" | "delegate" | "delegate_parallel";
      toolName?: string;
    }
  | { type: "next_step"; stepNumber: number }
  | { type: "done"; status: string }
  | { type: "error"; code: string; message: string };

export function parseAgentStreamEvent(eventName: string, data: unknown): AgentStreamEvent | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;

  switch (eventName) {
    case "coordinator_started":
    case "status":
    case "reasoning":
    case "tool_call_start":
    case "tool_call_result":
    case "tool_call_error":
    case "content_delta":
    case "message_end":
    case "plan":
    case "step_started":
    case "decision":
    case "next_step":
    case "done":
    case "error":
      return { type: eventName, ...payload } as AgentStreamEvent;
    default:
      return null;
  }
}
