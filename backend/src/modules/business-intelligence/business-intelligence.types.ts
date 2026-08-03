import { ExecutiveContextItem, ExecutiveContextSource } from '../ai/context/context.types';

export type BusinessIntelligenceScoreId =
  | 'executive_health'
  | 'financial_health'
  | 'sales_health'
  | 'operations_health'
  | 'customer_success_health'
  | 'communications_health'
  | 'compliance_health';
export type BusinessIntelligenceStatus = 'healthy' | 'watch' | 'at_risk' | 'unavailable';
export type BusinessIntelligenceCategory =
  | 'executive'
  | 'financial'
  | 'sales'
  | 'operations'
  | 'customer_success'
  | 'communications'
  | 'compliance';

export interface BusinessIntelligenceScore {
  id: BusinessIntelligenceScoreId;
  category: BusinessIntelligenceCategory;
  label: string;
  score: number | null;
  status: BusinessIntelligenceStatus;
  confidence: 'high' | 'medium' | 'low';
  formula: string;
  formulaVersion: '1.0';
  weights: Record<string, number>;
  inputs: Record<string, number>;
  evidence: ExecutiveContextItem[];
  sourceModules: ExecutiveContextSource[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  reasoning: string;
  generatedAt: string;
  trendStatus: 'unavailable';
  trendReason: 'historical_source_unavailable';
}

export interface BusinessIntelligenceResult {
  version: '1.0';
  generatedAt: string;
  tenantId: string;
  userId: string;
  executiveHealth: BusinessIntelligenceScore;
  departments: BusinessIntelligenceScore[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
}
