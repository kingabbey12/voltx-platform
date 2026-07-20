import { streamSse } from "@/lib/ai/sse-client";
import { apiClient } from "@/lib/api/client";

/**
 * Client for the Ask endpoints (backend: src/modules/ai/ask). Wire types
 * mirror AskStreamEvent and AskStructuredResponse on the server.
 */

export type TrustRegister = "evidence" | "record" | "opinion" | "inference";

export interface AskDoor {
  text: string;
  recordType: string;
  recordId: string;
}

export interface AskSegment {
  register: TrustRegister;
  text: string;
  basis?: string;
  doors: AskDoor[];
}

export interface AskAnswer {
  label: string;
  objective: string;
  recommended?: boolean;
}

export interface AskStructuredResponse {
  segments: AskSegment[];
  answers: AskAnswer[];
  suggestions: string[];
  heldApprovalIds: string[];
  ungroundedDoorsRemoved: number;
}

export type AskStreamEvent =
  | { type: "doing"; label: string }
  | { type: "sentence"; text: string }
  | { type: "held"; approvalId: string; toolName: string }
  | { type: "response"; response: AskStructuredResponse }
  | { type: "stopped" }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ResolvedRecord {
  type: string;
  id: string;
  label: string;
  route: string;
}

export async function* streamAsk(
  input: {
    agentId: string;
    conversationId: string;
    prompt: string;
    workspaceContext?: string[];
  },
  signal?: AbortSignal,
): AsyncGenerator<AskStreamEvent> {
  for await (const frame of streamSse("/ai/ask/stream", input, signal)) {
    const event = parseAskEvent(frame.event, frame.data);
    if (event) yield event;
  }
}

function parseAskEvent(name: string, data: unknown): AskStreamEvent | null {
  const record =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  switch (name) {
    case "doing":
      return typeof record.label === "string" ? { type: "doing", label: record.label } : null;
    case "sentence":
      return typeof record.text === "string" ? { type: "sentence", text: record.text } : null;
    case "held":
      return typeof record.approvalId === "string" && typeof record.toolName === "string"
        ? { type: "held", approvalId: record.approvalId, toolName: record.toolName }
        : null;
    case "response":
      return typeof record.response === "object" && record.response !== null
        ? { type: "response", response: record.response as AskStructuredResponse }
        : null;
    case "stopped":
      return { type: "stopped" };
    case "error":
      return {
        type: "error",
        message: typeof record.message === "string" ? record.message : "The answer failed",
      };
    case "done":
      return { type: "done" };
    default:
      return null;
  }
}

export const askApi = {
  resolveRecord: (recordType: string, recordId: string) =>
    apiClient.get<ResolvedRecord>(
      `/ai/ask/records/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}`,
    ),
};
