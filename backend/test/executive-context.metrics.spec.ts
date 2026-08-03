import { MetricsService } from '../src/modules/metrics/metrics.service';

describe('Executive context metrics', () => {
  it('registers context metrics once and records only low-cardinality labels', async () => {
    const metrics = new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
    metrics.recordExecutiveContextCache('miss');
    metrics.recordExecutiveContextCache('hit');
    metrics.recordExecutiveContextInvalidation('source', 'success');
    metrics.recordExecutiveContextInvalidation('source', 'failure');
    metrics.recordExecutiveContextAssemblyDuration(25);
    metrics.recordExecutiveContextSourceFetchDuration('crm', 10);
    metrics.recordExecutiveContextTrimmedItems('crm', 3);
    metrics.recordExecutiveContextExcludedSource('calendar', 'calendar_not_available');

    const output = await metrics.getMetrics();
    expect(output).toContain('voltx_executive_context_cache_total{result="hit"} 1');
    expect(output).toContain('voltx_executive_context_cache_total{result="miss"} 1');
    expect(output).toContain(
      'voltx_executive_context_invalidation_total{scope="source",result="success"} 1',
    );
    expect(output).toContain(
      'voltx_executive_context_invalidation_total{scope="source",result="failure"} 1',
    );
    expect(output).toContain('voltx_executive_context_assembly_duration_seconds_count 1');
    expect(output).toContain(
      'voltx_executive_context_source_fetch_duration_seconds_count{source="crm"} 1',
    );
    expect(output).toContain('voltx_executive_context_trimmed_items_total{source="crm"} 3');
    expect(output).toContain(
      'voltx_executive_context_excluded_sources_total{source="calendar",reason="calendar_not_available"} 1',
    );
    await metrics.onModuleDestroy();
  });
});
