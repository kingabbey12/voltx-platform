import {
  ExecutiveContext,
  ExecutiveContextItem,
  ExecutiveContextSource,
} from '../context/context.types';
import { ExecutiveInsight, InsightCategory } from './insights.types';

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 } as const;

export class ExecutiveInsightsRules {
  static generate(context: ExecutiveContext): ExecutiveInsight[] {
    const sections: Array<[InsightCategory, ExecutiveContextSource, ExecutiveContextItem[]]> = [
      ['sales', 'crm', context.crm.items],
      ['finance', 'finance', context.finance.items],
      ['operations', 'operations', context.operations.items],
      ['communications', 'communications', context.communications.items],
    ];
    const insights = sections
      .filter(([, source]) => context.metadata.sourcesIncluded.includes(source))
      .map(([category, source, items]) => this.fromSection(category, source, items, context));
    const highest = insights[0];
    if (highest) {
      insights.unshift({
        ...highest,
        id: 'executive-summary',
        category: 'executive_summary',
        title: 'Executive priority summary',
        summary: `The highest current priority is ${highest.title.toLowerCase()}.`,
        calculationPath: [
          'Select the highest deterministic insight by priority, evidence count, then ID.',
        ],
      });
    }
    return insights.sort(
      (a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.id.localeCompare(b.id),
    );
  }

  private static fromSection(
    category: InsightCategory,
    source: ExecutiveContextSource,
    items: ExecutiveContextItem[],
    context: ExecutiveContext,
  ): ExecutiveInsight {
    const evidence = [...items]
      .sort(
        (a, b) =>
          priorityWeight[b.priority] - priorityWeight[a.priority] || a.id.localeCompare(b.id),
      )
      .slice(0, 5);
    const critical = evidence.filter((item) => item.priority === 'critical').length;
    const high = evidence.filter((item) => item.priority === 'high').length;
    const priority = critical > 0 ? 'critical' : high > 0 ? 'high' : 'medium';
    const confidence = evidence.length >= 3 ? 'high' : evidence.length > 0 ? 'medium' : 'low';
    return {
      id: `${category}:${source}`,
      category,
      title: evidence.length
        ? `${evidence.length} ${source} items require attention`
        : `No current ${source} alerts`,
      summary: evidence.length
        ? `This is based on ${evidence.length} permission-filtered context records; no historical trend is inferred when no comparison data is available.`
        : `No permitted ${source} records are currently available for an evidence-backed conclusion.`,
      evidence,
      confidence,
      businessImpact: priority,
      affectedModule: source,
      priority,
      recommendedAction: { label: this.actionFor(source), requiresApproval: true },
      supportingMetrics: {
        recordsAvailable: items.length,
        criticalRecords: critical,
        highPriorityRecords: high,
      },
      calculationPath: [
        'Use Executive Context only.',
        'Rank records by context priority then stable ID.',
        'Derive confidence from available evidence count.',
      ],
      sourcesUsed: [source],
      excludedSources: context.metadata.excludedSources,
      generatedAt: context.metadata.generatedAt,
    };
  }

  private static actionFor(source: ExecutiveContextSource): string {
    return {
      crm: 'Review and follow up on priority deals',
      finance: 'Review finance exceptions',
      operations: 'Resolve blocking operational work',
      communications: 'Review priority customer conversations',
      notifications: 'Review critical notifications',
      calendar: 'Review schedule',
    }[source];
  }
}
