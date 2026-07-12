import { create } from "zustand";

export interface ImpersonationInfo {
  sessionId: string;
  organizationId: string;
  organizationName: string;
}

interface ImpersonationState {
  info: ImpersonationInfo | null;
  setInfo: (info: ImpersonationInfo | null) => void;
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  info: null,
  setInfo: (info) => set({ info }),
}));
