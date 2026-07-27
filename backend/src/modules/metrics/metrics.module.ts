import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsScrapeGuard } from './metrics-scrape.guard';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsScrapeGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
