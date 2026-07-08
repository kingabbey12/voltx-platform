import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OperatorSession } from "@/lib/api/operator";
import type { AgentStreamEvent } from "@/lib/ai/stream-events";

export interface CommandTurn {
  id: string;
  objective: string;
  agentId: string | null;
  agentRunId: string | null;
  allowedActions: boolean;
  status: "running" | "done" | "error";
  events: AgentStreamEvent[];
  finalText: string | null;
  toolCalls: { toolName: string; status: "running" | "done" | "error" }[];
  error: string | null;
  createdAt: number;
}

interface OperatorState {
  session: OperatorSession | null;
  allowActions: boolean;
  turns: CommandTurn[];
  setSession: (session: OperatorSession) => void;
  setAllowActions: (value: boolean) => void;
  startTurn: (turn: CommandTurn) => void;
  appendEvent: (turnId: string, event: AgentStreamEvent) => void;
  finishTurn: (turnId: string, patch: Partial<CommandTurn>) => void;
}

/**
 * Persisted (not just in-memory) because the Activity Timeline
 * (requirement #7) needs agent runs to survive a refresh, and the backend
 * has no "list my agent runs" endpoint — only GET runs/:runId/tree, which
 * requires already knowing the run id. This client-side list of run ids
 * the user genuinely triggered is what makes those ids discoverable again;
 * the actual run detail is always fetched live from the real endpoint,
 * never fabricated.
 */
export const useOperatorStore = create<OperatorState>()(
  persist(
    (set) => ({
      session: null,
      allowActions: false,
      turns: [],
      setSession: (session) => set({ session }),
      setAllowActions: (value) => set({ allowActions: value }),
      startTurn: (turn) => set((state) => ({ turns: [turn, ...state.turns].slice(0, 50) })),
      appendEvent: (turnId, event) =>
        set((state) => ({
          turns: state.turns.map((turn) =>
            turn.id === turnId ? { ...turn, events: [...turn.events, event] } : turn,
          ),
        })),
      finishTurn: (turnId, patch) =>
        set((state) => ({
          turns: state.turns.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn)),
        })),
    }),
    {
      name: "voltx.operator",
      partialize: (state) => ({
        allowActions: state.allowActions,
        turns: state.turns.map((turn) => ({ ...turn, events: [] })),
      }),
    },
  ),
);
