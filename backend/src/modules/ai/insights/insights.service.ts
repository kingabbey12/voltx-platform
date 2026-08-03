import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MetricsService } from '../../metrics/metrics.service';
import { ExecutiveContextService } from '../context/context.service';
import { ExecutiveInsightsEngine } from './insights.engine';
import { ExecutiveInsightsResult } from './insights.types';

@Injectable()
export class ExecutiveInsightsService {
  constructor(
    private readonly context: ExecutiveContextService,
    private readonly engine: ExecutiveInsightsEngine,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
  ) {}
  async generate(permissions: string[]): Promise<ExecutiveInsightsResult> {
    const startedAt = performance.now();
    try {
      const result = this.engine.build(await this.context.getExecutiveContext({ permissions }));
      await this.audit.record({
        action: 'generate',
        resource: 'executive_insights',
        resourceId: result.tenantId,
        metadata: { insightCount: result.insights.length },
      });
      this.metrics.recordExecutiveInsightsRequest('success', result.insights.length);
      this.metrics.recordExecutiveInsightsDuration(performance.now() - startedAt);
      return result;
    } catch (error) {
      this.metrics.recordExecutiveInsightsRequest('failure', 0);
      throw error;
    }
  }
}
