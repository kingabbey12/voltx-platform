import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal = new Counter({
    name: 'voltx_http_requests_total',
    help: 'Total number of HTTP requests served',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });
  private readonly httpRequestDurationMs = new Histogram({
    name: 'voltx_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      prefix: 'voltx_',
      register: this.registry,
    });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
