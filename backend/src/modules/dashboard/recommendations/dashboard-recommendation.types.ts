import {
  DashboardRecommendationActionType,
  DashboardRecommendationCategory,
  DashboardRecommendationSeverity,
  DashboardRecommendationStatus,
  Prisma,
} from '@prisma/client';

export interface RecommendationEvidence {
  type: string;
  recordId: string;
  recordLabel: string;
  reason: string;
  href: string;
}

export interface RecommendationActionDefinition {
  type: DashboardRecommendationActionType;
  label: string;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface DeterministicRecommendation {
  fingerprint: string;
  category: DashboardRecommendationCategory;
  severity: DashboardRecommendationSeverity;
  title: string;
  summary: string;
  explanation: string;
  businessImpact: string;
  recommendedNextStep: string;
  confidence: number;
  expiresAt?: Date;
  evidence: RecommendationEvidence[];
  actions: RecommendationActionDefinition[];
  metadata: Record<string, unknown>;
}

export interface RecommendationActionView {
  id: string;
  type: DashboardRecommendationActionType;
  label: string;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
  executedAt: string | null;
}

export interface RecommendationView {
  id: string;
  category: DashboardRecommendationCategory;
  severity: DashboardRecommendationSeverity;
  status: DashboardRecommendationStatus;
  title: string;
  summary: string;
  explanation: string;
  businessImpact: string;
  recommendedNextStep: string;
  confidence: number | null;
  generatedAt: string;
  expiresAt: string | null;
  staleAt: string | null;
  evidence: RecommendationEvidence[];
  actions: RecommendationActionView[];
}

export type RecommendationJson = Prisma.JsonValue;
