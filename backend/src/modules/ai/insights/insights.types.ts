import { ExecutiveContextItem, ExecutiveContextSource } from '../context/context.types';

export type InsightCategory =
  'executive_summary' | 'revenue' | 'sales' | 'finance' | 'operations' | 'communications';
export type InsightConfidence = 'high' | 'medium' | 'low';

export interface ExecutiveInsight {
  id: string;
  category: InsightCategory;
  title: string;
  summary: string;
  evidence: ExecutiveContextItem[];
  confidence: InsightConfidence;
  businessImpact: 'critical' | 'high' | 'medium' | 'low';
  affectedModule: ExecutiveContextSource;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: { label: string; requiresApproval: boolean };
  supportingMetrics: Record<string, number>;
  calculationPath: string[];
  sourcesUsed: ExecutiveContextSource[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  generatedAt: string;
}

export interface ExecutiveInsightsResult {
  insightVersion: '1.0';
  generatedAt: string;
  tenantId: string;
  userId: string;
  insights: ExecutiveInsight[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  trends: Array<{
    source: ExecutiveContextSource;
    trendStatus: 'unavailable';
    reason: 'historical_source_unavailable';
  }>;
}
