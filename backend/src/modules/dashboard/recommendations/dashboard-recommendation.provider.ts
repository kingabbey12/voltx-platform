import { Injectable } from '@nestjs/common';
import {
  DashboardContext,
  DashboardInsight,
  DashboardInsightProvider,
  DashboardPriority,
  DashboardPriorityProvider,
} from '../dashboard-providers.interface';
import { DashboardRecommendationService } from './dashboard-recommendation.service';

@Injectable()
export class DashboardRecommendationProvider
  implements DashboardInsightProvider, DashboardPriorityProvider
{
  constructor(private readonly recommendations: DashboardRecommendationService) {}

  async getInsights(_context: DashboardContext): Promise<DashboardInsight[]> {
    const recommendations = await this.recommendations.getRecommendations(3);
    return recommendations.map((recommendation) => ({
      type:
        recommendation.severity === 'CRITICAL' || recommendation.severity === 'WARNING'
          ? 'warning'
          : recommendation.severity === 'OPPORTUNITY'
            ? 'opportunity'
            : 'info',
      title: recommendation.title,
      explanation: recommendation.summary,
      confidence: recommendation.confidence ?? 1,
    }));
  }

  async getPriorities(_context: DashboardContext): Promise<DashboardPriority[]> {
    const recommendations = await this.recommendations.getRecommendations(5);
    return recommendations.map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      reason: recommendation.recommendedNextStep,
      urgency:
        recommendation.severity === 'CRITICAL' || recommendation.severity === 'WARNING'
          ? 'high'
          : recommendation.severity === 'OPPORTUNITY'
            ? 'medium'
            : 'low',
      href: `/dashboard?recommendation=${recommendation.id}`,
    }));
  }
}
