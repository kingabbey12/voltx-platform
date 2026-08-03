import { MetricsService } from '../src/modules/metrics/metrics.service';
import { BusinessIntelligenceService } from '../src/modules/business-intelligence/business-intelligence.service';

describe('Business Intelligence metrics', () => {
  function createMetrics(): MetricsService {
    return new MetricsService({ get: jest.fn().mockReturnValue(false) } as never);
  }

  it('registers each BI collector once per shared registry and exposes only fixed labels', async () => {
    const metrics = createMetrics();
    metrics.recordBusinessIntelligence('success', 12);
    metrics.recordBusinessIntelligenceScore(
      'financial',
      'unavailable',
      '1.0',
      'historical_source_unavailable',
    );
    metrics.recordBusinessIntelligenceExplain('failure');
    const output = await metrics.getMetrics();

    for (const name of [
      'voltx_business_intelligence_requests_total',
      'voltx_business_intelligence_generation_duration_seconds',
      'voltx_business_intelligence_scores_generated_total',
      'voltx_business_intelligence_score_status_total',
      'voltx_business_intelligence_formula_version_total',
      'voltx_business_intelligence_trend_unavailable_total',
      'voltx_business_intelligence_explain_requests_total',
    ]) {
      expect(output.match(new RegExp(`^# HELP ${name} `, 'm'))).toHaveLength(1);
    }
    expect(output).toContain('result="success"');
    expect(output).toContain('result="failure"');
    expect(output).toContain('category="financial"');
    expect(output).toContain('status="unavailable"');
    expect(output).toContain('formula_version="1.0"');
    expect(output).toContain('reason="historical_source_unavailable"');
    expect(output).not.toMatch(/tenant-|user-|opportunity|secret|prompt/i);
    await metrics.onModuleDestroy();
  });

  it('uses an isolated registry for a reconstructed service without duplicate collectors', () => {
    expect(() => createMetrics()).not.toThrow();
    expect(() => createMetrics()).not.toThrow();
  });

  it('records a service dependency failure without recording success or sensitive labels', async () => {
    const metrics = createMetrics();
    const failure = new Error('controlled context failure');
    const service = new BusinessIntelligenceService(
      { getExecutiveContext: jest.fn().mockRejectedValue(failure) } as never,
      { build: jest.fn() },
      { record: jest.fn() } as never,
      metrics,
    );

    await expect(service.generate(['ai.agent.run'])).rejects.toBe(failure);
    const output = await metrics.getMetrics();
    expect(output).toContain('voltx_business_intelligence_requests_total{result="failure"} 1');
    expect(output).not.toContain('voltx_business_intelligence_requests_total{result="success"} 1');
    expect(output).not.toMatch(/controlled context failure|tenant-|user-|opportunity/i);
    await metrics.onModuleDestroy();
  });
});
