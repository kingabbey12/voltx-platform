import { Injectable } from '@nestjs/common';
import { ExecutiveContext, ExecutiveContextSource } from '../ai/context/context.types';
import {
  BusinessIntelligenceCategory,
  BusinessIntelligenceResult,
  BusinessIntelligenceScore,
  BusinessIntelligenceScoreId,
} from './business-intelligence.types';
import {
  BUSINESS_INTELLIGENCE_FORMULA_VERSION,
  sourceScore,
  unavailable,
} from './business-intelligence.rules';

@Injectable()
export class BusinessIntelligenceEngine {
  build(context: ExecutiveContext): BusinessIntelligenceResult {
    const generatedAt = context.metadata.generatedAt;
    const score = (
      id: BusinessIntelligenceScoreId,
      label: string,
      sources: ExecutiveContextSource[],
    ): BusinessIntelligenceScore => {
      const excluded = context.metadata.excludedSources.filter((entry) =>
        sources.includes(entry.source),
      );
      const category = id.replace('_health', '') as BusinessIntelligenceCategory;
      if (sources.some((source) => unavailable(source, context.metadata.excludedSources)))
        return {
          id,
          category,
          label,
          score: null,
          status: 'unavailable',
          confidence: 'low',
          formula:
            'Unavailable when a required verified source is permission-limited or unavailable.',
          formulaVersion: BUSINESS_INTELLIGENCE_FORMULA_VERSION,
          weights: {},
          inputs: {},
          evidence: [],
          sourceModules: sources,
          excludedSources: excluded,
          reasoning: 'Required verified source unavailable; no score is fabricated.',
          generatedAt,
          trendStatus: 'unavailable',
          trendReason: 'historical_source_unavailable',
        };
      const parts = sources.map((source) => sourceScore(context[source]));
      const value = Math.round(parts.reduce((sum, part) => sum + part.score, 0) / parts.length);
      return {
        id,
        category,
        label,
        score: value,
        status: value >= 80 ? 'healthy' : value >= 60 ? 'watch' : 'at_risk',
        confidence: context.metadata.sourcesIncluded.length >= sources.length ? 'high' : 'medium',
        formula:
          '100 minus weighted verified critical and high-priority records, averaged across required sources.',
        formulaVersion: BUSINESS_INTELLIGENCE_FORMULA_VERSION,
        weights: { criticalRecord: -25, highPriorityRecord: -10 },
        // Source-prefixed so every input names the section it came from.
        // Built with an explicit reduce rather than a spread into
        // Object.assign, which erases the value type to `any`.
        inputs: parts.reduce<Record<string, number>>((accumulated, part, index) => {
          for (const [key, input] of Object.entries(part.inputs)) {
            accumulated[`${sources[index]}.${key}`] = input;
          }
          return accumulated;
        }, {}),
        evidence: sources.flatMap((source) => context[source].items),
        sourceModules: sources,
        excludedSources: excluded,
        reasoning: parts.map((part, index) => `${sources[index]}: ${part.reasoning}`).join(' '),
        generatedAt,
        trendStatus: 'unavailable',
        trendReason: 'historical_source_unavailable',
      };
    };
    const departments = [
      score('financial_health', 'Financial Health', ['finance']),
      score('sales_health', 'Sales Health', ['crm']),
      score('operations_health', 'Operations Health', ['operations']),
      score('customer_success_health', 'Customer Success Health', ['communications']),
      score('communications_health', 'Communications Health', ['communications']),
      score('compliance_health', 'Compliance Health', ['notifications']),
    ];
    const available = departments.filter((item) => item.score !== null);
    const executiveHealth = available.length
      ? {
          ...score(
            'executive_health',
            'Executive Health',
            available.flatMap((item) => item.sourceModules),
          ),
          score: Math.round(
            available.reduce((sum, item) => sum + item.score!, 0) / available.length,
          ),
        }
      : {
          id: 'executive_health' as const,
          category: 'executive' as const,
          label: 'Executive Health',
          score: null,
          status: 'unavailable' as const,
          confidence: 'low' as const,
          formula: 'Unavailable when no permitted verified department score is available.',
          formulaVersion: BUSINESS_INTELLIGENCE_FORMULA_VERSION,
          weights: {},
          inputs: {},
          evidence: [],
          sourceModules: [],
          excludedSources: context.metadata.excludedSources,
          reasoning:
            'No permitted verified department source is available; no executive score is fabricated.',
          generatedAt,
          trendStatus: 'unavailable' as const,
          trendReason: 'historical_source_unavailable' as const,
        };
    return {
      version: '1.0',
      generatedAt,
      tenantId: context.metadata.tenantId,
      userId: context.metadata.userId,
      executiveHealth,
      departments,
      excludedSources: context.metadata.excludedSources,
    };
  }
}
