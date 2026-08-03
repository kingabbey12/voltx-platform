import { apiClient } from "./client";

export type Insight = { id: string; category: string; title: string; summary: string; confidence: string; priority: string; affectedModule: string; evidence: Array<{ id: string; label: string }>; recommendedAction: { label: string; requiresApproval: boolean }; supportingMetrics: Record<string, number>; generatedAt: string };
export type InsightsResult = { generatedAt: string; insights: Insight[]; excludedSources: Array<{ source: string; reason: string }>; trends: Array<{ source: string; trendStatus: "unavailable"; reason: string }> };
export const insightsApi = { get: () => apiClient.get<InsightsResult>("/ai/insights") };
