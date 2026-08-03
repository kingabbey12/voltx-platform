import { ExecutiveContext } from '../src/modules/ai/context/context.types';
import { ExecutiveContextService } from '../src/modules/ai/context/context.service';
import { ExecutiveInsightsEngine } from '../src/modules/ai/insights/insights.engine';
import { ExecutiveInsightsService } from '../src/modules/ai/insights/insights.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

const context: ExecutiveContext = {
  organization: { id: 'tenant-1' },
  user: { id: 'user-1' },
  crm: {
    total: 1,
    summary: '1 records included.',
    items: [{ id: 'opportunity:a', label: 'Renewal A', priority: 'high' }],
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
    tokenEstimate: 32,
  },
};

function buildService(
  metrics: MetricsService,
  getExecutiveContext: jest.Mock,
): ExecutiveInsightsService {
  return new ExecutiveInsightsService(
    { getExecutiveContext } as unknown as ExecutiveContextService,
    new ExecutiveInsightsEngine(),
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    metrics,
  );
}

describe('Executive insights metrics', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
  });

  afterEach(async () => {
    await metrics.onModuleDestroy();
  });

  it('registers the insight metrics once with low-cardinality labels only', async () => {
    const service = buildService(metrics, jest.fn().mockResolvedValue(context));
    await service.generate(['sales.opportunity.read']);
    await service.generate(['sales.opportunity.read']);

    const output = await metrics.getMetrics();

    expect(output.match(/^# HELP voltx_executive_insights_requests_total /gm) ?? []).toHaveLength(
      1,
    );
    expect(
      output.match(/^# HELP voltx_executive_insights_generation_duration_seconds /gm) ?? [],
    ).toHaveLength(1);
    expect(output).toContain('voltx_executive_insights_requests_total{result="success"} 2');
    expect(output).toContain('voltx_executive_insights_generation_duration_seconds_count 2');
  });

  it('observes generation duration for every authorized request', async () => {
    const service = buildService(metrics, jest.fn().mockResolvedValue(context));
    await service.generate(['sales.opportunity.read']);

    const output = await metrics.getMetrics();
    const sum = /voltx_executive_insights_generation_duration_seconds_sum (\S+)/.exec(output);

    expect(output).toContain('voltx_executive_insights_generation_duration_seconds_count 1');
    expect(sum).not.toBeNull();
    expect(Number(sum![1])).toBeGreaterThanOrEqual(0);
  });

  it('records a failure result when generation throws and does not count it as success', async () => {
    const service = buildService(
      metrics,
      jest.fn().mockRejectedValue(new Error('context unavailable')),
    );

    await expect(service.generate(['sales.opportunity.read'])).rejects.toThrow(
      'context unavailable',
    );

    const output = await metrics.getMetrics();
    expect(output).toContain('voltx_executive_insights_requests_total{result="failure"} 1');
    expect(output).not.toContain('voltx_executive_insights_requests_total{result="success"}');
  });

  it('never labels insight metrics with tenant, user, prompt, or record identifiers', async () => {
    const service = buildService(metrics, jest.fn().mockResolvedValue(context));
    await service.generate(['sales.opportunity.read']);

    const output = await metrics.getMetrics();
    const insightLines = output
      .split('\n')
      .filter((line) => line.startsWith('voltx_executive_insights_'));

    expect(insightLines.length).toBeGreaterThan(0);
    for (const line of insightLines) {
      const labels = /\{([^}]*)\}/.exec(line)?.[1] ?? '';
      const names = labels
        .split(',')
        .map((pair) => pair.split('=')[0].trim())
        .filter(Boolean);
      expect(names.every((name) => ['result', 'le'].includes(name))).toBe(true);
      expect(line).not.toContain('tenant-1');
      expect(line).not.toContain('user-1');
      expect(line).not.toContain('opportunity:a');
      expect(line).not.toContain('Renewal A');
    }
  });
});
