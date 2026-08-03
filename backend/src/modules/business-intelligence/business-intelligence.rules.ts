import { ExecutiveContextSection, ExecutiveContextSource } from '../ai/context/context.types';

export const BUSINESS_INTELLIGENCE_FORMULA_VERSION = '1.0' as const;

export function sourceScore(section: ExecutiveContextSection): {
  score: number;
  inputs: Record<string, number>;
  reasoning: string;
} {
  const critical = section.items.filter((item) => item.priority === 'critical').length;
  const high = section.items.filter((item) => item.priority === 'high').length;
  const score = Math.max(0, 100 - critical * 25 - high * 10);
  return {
    score,
    inputs: { totalRecords: section.total, criticalRecords: critical, highPriorityRecords: high },
    reasoning: `Starts at 100; subtracts 25 per critical and 10 per high-priority verified record.`,
  };
}

export function unavailable(
  source: ExecutiveContextSource,
  excluded: Array<{ source: ExecutiveContextSource; reason: string }>,
) {
  return excluded.some((entry) => entry.source === source);
}
