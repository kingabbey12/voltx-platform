import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../metrics/metrics.service';
import { ExecutiveContext } from '../ai/context/context.types';
import { ExecutiveContextService } from '../ai/context/context.service';
import { BusinessIntelligenceEngine } from './business-intelligence.engine';
import { BusinessIntelligenceResult } from './business-intelligence.types';

@Injectable()
export class BusinessIntelligenceService {
  constructor(
    private readonly context: ExecutiveContextService,
    private readonly engine: BusinessIntelligenceEngine,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
  ) {}
  async generate(permissions: string[]): Promise<BusinessIntelligenceResult> {
    const startedAt = performance.now();
    try {
      const result = await this.generateFromContext(
        await this.context.getExecutiveContext({ permissions }),
      );
      this.metrics.recordBusinessIntelligence('success', performance.now() - startedAt);
      return result;
    } catch (error) {
      this.metrics.recordBusinessIntelligence('failure');
      throw error;
    }
  }
  async generateFromContext(context: ExecutiveContext): Promise<BusinessIntelligenceResult> {
    const result = this.engine.build(context);
    await this.audit.record({
      action: 'generate',
      resource: 'business_intelligence',
      resourceId: result.tenantId,
      metadata: { formulaVersion: result.version, scoreCount: result.departments.length + 1 },
    });
    for (const score of [result.executiveHealth, ...result.departments])
      this.metrics.recordBusinessIntelligenceScore(
        score.category,
        score.status,
        score.formulaVersion,
        score.trendReason,
      );
    return result;
  }

  async explain(
    scoreId: string,
    permissions: string[],
  ): Promise<BusinessIntelligenceResult['executiveHealth']> {
    try {
      const result = await this.generate(permissions);
      const score =
        scoreId === 'executive_health'
          ? result.executiveHealth
          : result.departments.find((item) => item.id === scoreId);

      if (!score) {
        throw new NotFoundException('Unknown business intelligence score');
      }

      this.metrics.recordBusinessIntelligenceExplain('success');
      return score;
    } catch (error) {
      this.metrics.recordBusinessIntelligenceExplain('failure');
      throw error;
    }
  }
}
