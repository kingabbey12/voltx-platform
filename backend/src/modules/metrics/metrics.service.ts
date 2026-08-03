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
  /** Exposed read-only so feature modules (e.g. the multi-agent
   * orchestrator) can register their own collectors on the single shared
   * registry instead of standing up a second scrape target. */
  readonly registry = new Registry();
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
  /** v2.2 Enterprise Identity (Phase 1) — incremented in SsoService for both SAML ACS and OIDC callback completion. */
  private readonly ssoLoginTotal = new Counter({
    name: 'voltx_sso_login_total',
    help: 'Total number of SSO login attempts via SAML or OIDC',
    labelNames: ['protocol', 'outcome'] as const,
    registers: [this.registry],
  });
  /** v2.2 SCIM 2.0 (Phase 2) — incremented in ScimProvisionJobRepository.record(), the single chokepoint every SCIM user/group operation writes through. */
  private readonly scimOperationsTotal = new Counter({
    name: 'voltx_scim_operations_total',
    help: 'Total number of SCIM provisioning operations',
    labelNames: ['operation', 'status'] as const,
    registers: [this.registry],
  });
  /** v2.2 Security Center (Phase 4) — incremented in MfaService.verifyLogin() around its TOTP/backup-code check. */
  private readonly mfaChallengesTotal = new Counter({
    name: 'voltx_mfa_challenges_total',
    help: 'Total number of MFA login challenges verified',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  /** v2.2 Security Center (Phase 4) — incremented in SessionsService.revoke(). */
  private readonly sessionRevocationsTotal = new Counter({
    name: 'voltx_session_revocations_total',
    help: 'Total number of user sessions revoked',
    registers: [this.registry],
  });
  private readonly executiveContextCacheTotal = new Counter({
    name: 'voltx_executive_context_cache_total',
    help: 'Executive context cache lookups by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly executiveContextInvalidationTotal = new Counter({
    name: 'voltx_executive_context_invalidation_total',
    help: 'Executive context cache invalidations by scope and result',
    labelNames: ['scope', 'result'] as const,
    registers: [this.registry],
  });
  private readonly executiveContextAssemblyDurationSeconds = new Histogram({
    name: 'voltx_executive_context_assembly_duration_seconds',
    help: 'Executive context assembly duration in seconds',
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly executiveContextSourceFetchDurationSeconds = new Histogram({
    name: 'voltx_executive_context_source_fetch_duration_seconds',
    help: 'Executive context source fetch duration in seconds',
    labelNames: ['source'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly executiveContextTrimmedItemsTotal = new Counter({
    name: 'voltx_executive_context_trimmed_items_total',
    help: 'Executive context items omitted by the source budget',
    labelNames: ['source'] as const,
    registers: [this.registry],
  });
  private readonly executiveContextExcludedSourcesTotal = new Counter({
    name: 'voltx_executive_context_excluded_sources_total',
    help: 'Executive context excluded sources by reason',
    labelNames: ['source', 'reason'] as const,
    registers: [this.registry],
  });
  private readonly executiveInsightsRequestsTotal = new Counter({
    name: 'voltx_executive_insights_requests_total',
    help: 'Executive insights generation requests by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly executiveInsightsDurationSeconds = new Histogram({
    name: 'voltx_executive_insights_generation_duration_seconds',
    help: 'Executive insights generation duration in seconds',
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly objectStorageHealth = new Gauge({
    name: 'voltx_object_storage_health',
    help: 'Object storage reachability from the continuous readiness probe (1 = up, 0 = down)',
    registers: [this.registry],
  });

  private readonly executiveDecisionsRequestsTotal = new Counter({
    name: 'voltx_executive_decisions_requests_total',
    help: 'Executive decision generation requests by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly executiveDecisionsDurationSeconds = new Histogram({
    name: 'voltx_executive_decisions_generation_duration_seconds',
    help: 'Executive decision generation duration in seconds',
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly executiveDecisionsCategoryTotal = new Counter({
    name: 'voltx_executive_decisions_category_total',
    help: 'Executive decisions generated by category',
    labelNames: ['category'] as const,
    registers: [this.registry],
  });
  private readonly executiveDecisionsPriorityTotal = new Counter({
    name: 'voltx_executive_decisions_priority_total',
    help: 'Executive decisions generated by priority',
    labelNames: ['priority'] as const,
    registers: [this.registry],
  });
  private readonly executiveDecisionsApprovalRequiredTotal = new Counter({
    name: 'voltx_executive_decisions_approval_required_total',
    help: 'Executive decisions by whether the recommendation requires approval',
    labelNames: ['approval_required'] as const,
    registers: [this.registry],
  });
  private readonly executiveDecisionRuleMatchesTotal = new Counter({
    name: 'voltx_executive_decision_rule_matches_total',
    help: 'Executive decision rule matches by rule id',
    labelNames: ['rule'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceRequestsTotal = new Counter({
    name: 'voltx_business_intelligence_requests_total',
    help: 'Business intelligence requests by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceGenerationDurationSeconds = new Histogram({
    name: 'voltx_business_intelligence_generation_duration_seconds',
    help: 'Business intelligence generation duration',
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly businessIntelligenceScoresGeneratedTotal = new Counter({
    name: 'voltx_business_intelligence_scores_generated_total',
    help: 'Business intelligence scores by category',
    labelNames: ['category'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceScoreStatusTotal = new Counter({
    name: 'voltx_business_intelligence_score_status_total',
    help: 'Business intelligence scores by status',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceFormulaVersionTotal = new Counter({
    name: 'voltx_business_intelligence_formula_version_total',
    help: 'Business intelligence formulas by version',
    labelNames: ['formula_version'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceTrendUnavailableTotal = new Counter({
    name: 'voltx_business_intelligence_trend_unavailable_total',
    help: 'Business intelligence unavailable trends by reason',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });
  private readonly businessIntelligenceExplainRequestsTotal = new Counter({
    name: 'voltx_business_intelligence_explain_requests_total',
    help: 'Business intelligence explain requests by result',
    labelNames: ['result'] as const,
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

  recordSsoLogin(protocol: 'SAML' | 'OIDC', outcome: 'success' | 'failure'): void {
    this.ssoLoginTotal.inc({ protocol, outcome });
  }

  recordScimOperation(operation: string, status: 'SUCCESS' | 'FAILED'): void {
    this.scimOperationsTotal.inc({ operation, status });
  }

  recordMfaChallenge(outcome: 'success' | 'failure'): void {
    this.mfaChallengesTotal.inc({ outcome });
  }

  recordSessionRevocation(): void {
    this.sessionRevocationsTotal.inc();
  }

  recordExecutiveContextCache(result: 'hit' | 'miss'): void {
    this.executiveContextCacheTotal.inc({ result });
  }

  recordExecutiveContextInvalidation(
    scope: 'tenant' | 'user' | 'source',
    result: 'success' | 'failure',
  ): void {
    this.executiveContextInvalidationTotal.inc({ scope, result });
  }

  recordExecutiveContextAssemblyDuration(durationMs: number): void {
    this.executiveContextAssemblyDurationSeconds.observe(durationMs / 1000);
  }

  recordExecutiveContextSourceFetchDuration(source: string, durationMs: number): void {
    this.executiveContextSourceFetchDurationSeconds.observe({ source }, durationMs / 1000);
  }

  recordExecutiveContextTrimmedItems(source: string, count: number): void {
    if (count > 0) this.executiveContextTrimmedItemsTotal.inc({ source }, count);
  }

  recordExecutiveContextExcludedSource(source: string, reason: string): void {
    this.executiveContextExcludedSourcesTotal.inc({ source, reason });
  }

  recordExecutiveInsightsRequest(result: 'success' | 'failure', _insightCount: number): void {
    this.executiveInsightsRequestsTotal.inc({ result });
  }

  recordExecutiveInsightsDuration(durationMs: number): void {
    this.executiveInsightsDurationSeconds.observe(durationMs / 1000);
  }

  /**
   * Object storage is degradable: readiness stays `degraded` rather than
   * `not_ready`, so this gauge is what makes the outage actionable instead
   * of merely visible in a payload nobody scrapes.
   */
  recordObjectStorageHealth(up: boolean): void {
    this.objectStorageHealth.set(up ? 1 : 0);
  }

  recordExecutiveDecisionsRequest(result: 'success' | 'failure'): void {
    this.executiveDecisionsRequestsTotal.inc({ result });
  }

  recordExecutiveDecisionsDuration(durationMs: number): void {
    this.executiveDecisionsDurationSeconds.observe(durationMs / 1000);
  }

  /** `category` is a fixed DecisionCategory union — never tenant-derived. */
  recordExecutiveDecisionCategory(category: string): void {
    this.executiveDecisionsCategoryTotal.inc({ category });
  }

  recordExecutiveDecisionPriority(priority: string, count: number): void {
    if (count > 0) this.executiveDecisionsPriorityTotal.inc({ priority }, count);
  }

  recordExecutiveDecisionApproval(approvalRequired: boolean): void {
    this.executiveDecisionsApprovalRequiredTotal.inc({
      approval_required: String(approvalRequired),
    });
  }

  /** `rule` is a fixed rule id from the static DECISION_RULES catalog. */
  recordExecutiveDecisionRuleMatch(rule: string): void {
    this.executiveDecisionRuleMatchesTotal.inc({ rule });
  }

  recordBusinessIntelligence(result: 'success' | 'failure', durationMs?: number): void {
    this.businessIntelligenceRequestsTotal.inc({ result });
    if (durationMs !== undefined) {
      this.businessIntelligenceGenerationDurationSeconds.observe(durationMs / 1000);
    }
  }

  /** All labels are fixed BI vocabulary, never tenant or record derived. */
  recordBusinessIntelligenceScore(
    category:
      | 'executive'
      | 'financial'
      | 'sales'
      | 'operations'
      | 'customer_success'
      | 'communications'
      | 'compliance',
    status: 'healthy' | 'watch' | 'at_risk' | 'unavailable',
    formulaVersion: '1.0',
    trendReason: 'historical_source_unavailable',
  ): void {
    this.businessIntelligenceScoresGeneratedTotal.inc({ category });
    this.businessIntelligenceScoreStatusTotal.inc({ status });
    this.businessIntelligenceFormulaVersionTotal.inc({ formula_version: formulaVersion });
    this.businessIntelligenceTrendUnavailableTotal.inc({ reason: trendReason });
  }

  recordBusinessIntelligenceExplain(result: 'success' | 'failure'): void {
    this.businessIntelligenceExplainRequestsTotal.inc({ result });
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
