import { create } from "zustand";

interface RecentPageVisit {
  label: string;
  path: string;
  at: number;
}

interface RecentPagesState {
  visits: RecentPageVisit[];
  record: (label: string, path: string) => void;
}

const MAX_VISITS = 8;

/**
 * Lightweight, session-only "recent history" for the AI Context Engine —
 * distinct from AI Memory (long-term, backend-persisted) and from
 * conversation history (the messages within a single chat). Just tracks
 * which pages the user has been on this session so the AI's workspace
 * context can include "user was recently viewing X".
 */
export const useRecentPagesStore = create<RecentPagesState>((set) => ({
  visits: [],
  record: (label, path) =>
    set((state) => {
      if (state.visits[0]?.path === path) return state;
      const next = [{ label, path, at: Date.now() }, ...state.visits.filter((v) => v.path !== path)];
      return { visits: next.slice(0, MAX_VISITS) };
    }),
}));
