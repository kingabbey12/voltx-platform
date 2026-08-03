import { ExecutiveInsightsRules } from '../src/modules/ai/insights/insights.rules';
import { ExecutiveContext } from '../src/modules/ai/context/context.types';

describe('ExecutiveInsightsRules', () => {
  it('derives deterministic, explainable recommendations from Executive Context only', () => {
    const context: ExecutiveContext = {
      organization: { id: 'tenant-1' },
      user: { id: 'user-1' },
      crm: {
        total: 2,
        summary: '2 records included.',
        items: [
          { id: 'b', label: 'Deal B', priority: 'high' },
          { id: 'a', label: 'Deal A', priority: 'high' },
        ],
      },
      finance: { total: 0, summary: 'No data available.', items: [] },
      operations: { total: 0, summary: 'No data available.', items: [] },
      communications: { total: 0, summary: 'No data available.', items: [] },
      notifications: { total: 0, summary: 'No data available.', items: [] },
      calendar: { total: 0, summary: 'No data available.', items: [] },
      metadata: {
        generatedAt: '2026-08-02T00:00:00.000Z',
        contextVersion: '1.0',
        tenantId: 'tenant-1',
        userId: 'user-1',
        sourcesIncluded: ['crm'],
        excludedSources: [{ source: 'calendar', reason: 'calendar_not_available' }],
        tokenEstimate: 1,
      },
    };
    const first = ExecutiveInsightsRules.generate(context);
    const second = ExecutiveInsightsRules.generate(context);
    expect(first).toEqual(second);
    expect(first[0]).toEqual(
      expect.objectContaining({
        category: 'executive_summary',
        confidence: 'medium',
        sourcesUsed: ['crm'],
      }),
    );
    expect(
      first.find((item) => item.category === 'sales')?.evidence.map((item) => item.id),
    ).toEqual(['a', 'b']);
    expect(first.every((item) => item.recommendedAction.requiresApproval)).toBe(true);
  });
});
