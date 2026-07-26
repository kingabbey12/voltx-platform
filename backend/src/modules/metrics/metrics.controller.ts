import { Controller, Get, Header, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsScrapeGuard } from './metrics-scrape.guard';
import { MetricsService } from './metrics.service';

@Controller({ path: '', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @SkipThrottle()
  // Open when METRICS_AUTH_TOKEN is unset (dev/test), token-gated otherwise.
  // Production cannot boot without the token — see MetricsScrapeGuard.
  @UseGuards(MetricsScrapeGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
