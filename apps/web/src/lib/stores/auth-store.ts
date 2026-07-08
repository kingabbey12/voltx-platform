import { create } from "zustand";
import type { CurrentUser } from "@/lib/api/auth";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: CurrentUser | null;
  status: SessionStatus;
  setUser: (user: CurrentUser) => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setUser: (user) => set({ user, status: "authenticated" }),
  setUnauthenticated: () => set({ user: null, status: "unauthenticated" }),
}));
