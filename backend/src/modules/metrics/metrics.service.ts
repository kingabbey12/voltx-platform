import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { AGENT_TASK_QUEUE } from '../ai/agents/jobs/agent-task-queue.constants';
import { ATTACHMENT_PROCESS_QUEUE } from '../attachments/processing/attachment-processing.constants';
import { AI_PROCESS_QUEUE } from '../communications/jobs/communications-jobs.constants';
import { WORKFLOW_RUN_QUEUE } from '../workflows/jobs/workflow-run-queue.constants';
import { STRIPE_WEBHOOK_QUEUE } from '../billing/jobs/stripe-webhook-queue.constants';

const MONITORED_QUEUES = [
  AGENT_TASK_QUEUE,
  ATTACHMENT_PROCESS_QUEUE,
  AI_PROCESS_QUEUE,
  WORKFLOW_RUN_QUEUE,
  STRIPE_WEBHOOK_QUEUE,
];

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly registry = new Registry();
  private readonly queues = new Map<string, Queue>();
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

  constructor(private readonly configService: ConfigService) {
    collectDefaultMetrics({
      prefix: 'voltx_',
      register: this.registry,
    });

    if (this.configService.get<boolean>('redis.enabled', false)) {
      const connection = {
        url: this.configService.get<string>('redis.url', 'redis://localhost:6379'),
      };
      for (const queueName of MONITORED_QUEUES) {
        this.queues.set(queueName, new Queue(queueName, { connection }));
      }

      const getQueueDepths = () => this.getQueueDepths();
      new Gauge({
        name: 'voltx_queue_depth',
        help: 'Current BullMQ job counts per queue and state',
        labelNames: ['queue', 'state'] as const,
        registers: [this.registry],
        // Collected on-demand (via this callback) rather than polled on a
        // timer — queue depth is only ever read when something scrapes
        // /metrics, so there's no reason to hit Redis on a schedule
        // nobody's consuming.
        async collect() {
          const depths = await getQueueDepths();
          for (const [queueName, counts] of Object.entries(depths)) {
            for (const [state, count] of Object.entries(counts)) {
              this.set({ queue: queueName, state }, count);
            }
          }
        },
      });
    }
  }

  /**
   * Per-queue BullMQ job counts, shared by the /metrics Gauge above and
   * the Platform Console's system-health endpoint
   * (src/modules/platform/system-health/) so neither has its own copy of
   * this Redis-reading logic. Returns `{}` when Redis is disabled — the
   * health endpoint's source of truth for Redis reachability is
   * HealthService, not this method.
   */
  async getQueueDepths(): Promise<Record<string, Record<string, number>>> {
    const depths: Record<string, Record<string, number>> = {};
    for (const [queueName, queue] of this.queues) {
      try {
        depths[queueName] = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
      } catch {
        // Redis being briefly unreachable shouldn't break the whole
        // /metrics scrape or system-health read — the health endpoint is
        // the source of truth for Redis reachability, this just goes stale.
      }
    }
    return depths;
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

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
