import { apiClient } from "./client";

export type BiStatus = "healthy" | "watch" | "at_risk" | "unavailable";
export type BiConfidence = "high" | "medium" | "low";
export type BiPriority = "critical" | "high" | "medium" | "low";

export type BiEvidence = {
  id: string;
  label: string;
  priority: BiPriority;
  occurredAt?: string;
  amount?: number;
};

export type BiScore = {
  id: string;
  category: string;
  label: string;
  score: number | null;
  status: BiStatus;
  confidence: BiConfidence;
  formula: string;
  formulaVersion: string;
  weights: Record<string, number>;
  inputs: Record<string, number>;
  evidence: BiEvidence[];
  sourceModules: string[];
  excludedSources: Array<{ source: string; reason: string }>;
  reasoning: string;
  generatedAt: string;
  trendStatus: "unavailable";
  trendReason: "historical_source_unavailable";
};

export type BiResult = {
  version: string;
  generatedAt: string;
  tenantId: string;
  userId: string;
  executiveHealth: BiScore;
  departments: BiScore[];
  excludedSources: Array<{ source: string; reason: string }>;
};

export const businessIntelligenceApi = {
  /**
   * The single read the dashboard performs. Executive health, every
   * department score, evidence, formulas and reasoning all arrive from the
   * backend already computed — the client never recalculates a score.
   */
  get: (signal?: AbortSignal) => apiClient.get<BiResult>("/business-intelligence", { signal }),
};
