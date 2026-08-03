import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { CACHE_SERVICE, CacheService } from '../../cache/cache.service';
import { MetricsService } from '../../metrics/metrics.service';
import { ExecutiveContextBuilder } from './context.builder';
import {
  CrmContextProvider,
  CommunicationsContextProvider,
  ExecutiveContextProvider,
  FinanceContextProvider,
  NotificationsContextProvider,
  OperationsContextProvider,
} from './context.providers';
import {
  ExecutiveContext,
  ExecutiveContextBuildOptions,
  ExecutiveContextSection,
  ExecutiveContextSource,
} from './context.types';

const EMPTY_SECTION: ExecutiveContextSection = {
  items: [],
  total: 0,
  summary: 'No data available.',
};
const CONTEXT_TTL_MS = 30_000;

@Injectable()
export class ExecutiveContextInvalidationService {
  private readonly logger = new Logger(ExecutiveContextInvalidationService.name);

  constructor(
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidate('tenant', `executive-context:tenant:${tenantId}`, { tenantId });
  }

  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    await this.invalidate('user', `executive-context:user:${tenantId}:${userId}`, {
      tenantId,
      userId,
    });
  }

  async invalidateSource(
    tenantId: string,
    source: ExecutiveContextSource,
    userId?: string,
  ): Promise<void> {
    const tag = userId
      ? `executive-context:source:${tenantId}:${userId}:${source}`
      : `executive-context:source:${tenantId}:${source}`;
    await this.invalidate('source', tag, { tenantId, userId, source });
  }

  private async invalidate(
    scope: 'tenant' | 'user' | 'source',
    tag: string,
    fields: { tenantId: string; userId?: string; source?: ExecutiveContextSource },
  ): Promise<void> {
    try {
      await this.cacheService.invalidateTag(tag);
      this.metricsService?.recordExecutiveContextInvalidation(scope, 'success');
    } catch (error) {
      this.metricsService?.recordExecutiveContextInvalidation(scope, 'failure');
      this.logger.warn({ err: error, ...fields }, 'Executive context cache invalidation failed');
    }
  }
}

@Injectable()
export class ExecutiveContextService {
  private readonly providers: ExecutiveContextProvider[];
  private readonly logger = new Logger(ExecutiveContextService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
    private readonly invalidationService: ExecutiveContextInvalidationService,
    private readonly metricsService: MetricsService,
    crmProvider: CrmContextProvider,
    financeProvider: FinanceContextProvider,
    operationsProvider: OperationsContextProvider,
    communicationsProvider: CommunicationsContextProvider,
    notificationsProvider: NotificationsContextProvider,
  ) {
    this.providers = [
      crmProvider,
      financeProvider,
      operationsProvider,
      communicationsProvider,
      notificationsProvider,
    ];
  }

  async getExecutiveContext(options: ExecutiveContextBuildOptions): Promise<ExecutiveContext> {
    const startedAt = performance.now();
    const { organizationId, userId } = this.tenantContext.getOrThrow();
    const cacheKey = `executive-context:${organizationId}:${userId}:${this.permissionFingerprint(options.permissions)}`;
    const cached = await this.getCachedContext(cacheKey, organizationId, userId);
    if (cached) {
      this.metricsService.recordExecutiveContextCache('hit');
      this.metricsService.recordExecutiveContextAssemblyDuration(performance.now() - startedAt);
      return cached;
    }
    this.metricsService.recordExecutiveContextCache('miss');

    const excludedSources: ExecutiveContext['metadata']['excludedSources'] = [
      { source: 'calendar', reason: 'calendar_not_available' },
    ];
    const sections: Partial<
      Record<
        Exclude<ExecutiveContext['metadata']['sourcesIncluded'][number], 'calendar'>,
        ExecutiveContextSection
      >
    > = {};
    const eligible = this.providers.filter((provider) => {
      const allowed = provider.requiredPermissions.some((permission) =>
        options.permissions.includes(permission),
      );
      if (!allowed) excludedSources.push({ source: provider.source, reason: 'missing_permission' });
      return allowed;
    });
    const results = await Promise.allSettled(
      eligible.map(async (provider) => {
        const sourceStartedAt = performance.now();
        try {
          return await provider.collect(options.permissions);
        } finally {
          this.metricsService.recordExecutiveContextSourceFetchDuration(
            provider.source,
            performance.now() - sourceStartedAt,
          );
        }
      }),
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const provider = eligible[index];
      if (result.status === 'rejected') {
        excludedSources.push({ source: provider.source, reason: 'source_error' });
        continue;
      }
      const source = result.value.source as Exclude<
        ExecutiveContext['metadata']['sourcesIncluded'][number],
        'calendar'
      >;
      sections[source] = ExecutiveContextBuilder.section(
        result.value.items,
        result.value.total,
        options.maxItemsPerSource ?? 20,
        'No records available.',
      );
      this.metricsService.recordExecutiveContextTrimmedItems(
        source,
        Math.max(0, result.value.total - sections[source].items.length),
      );
    }
    const context: ExecutiveContext = {
      organization: { id: organizationId },
      user: { id: userId },
      crm: sections.crm ?? EMPTY_SECTION,
      finance: sections.finance ?? EMPTY_SECTION,
      operations: sections.operations ?? EMPTY_SECTION,
      communications: sections.communications ?? EMPTY_SECTION,
      notifications: sections.notifications ?? EMPTY_SECTION,
      calendar: EMPTY_SECTION,
      metadata: {
        generatedAt: new Date().toISOString(),
        contextVersion: '1.0',
        tenantId: organizationId,
        userId,
        sourcesIncluded: Object.keys(sections) as ExecutiveContext['metadata']['sourcesIncluded'],
        excludedSources,
        tokenEstimate: 0,
      },
    };
    context.metadata.tokenEstimate = Math.ceil(JSON.stringify(context).length / 4);
    for (const excluded of excludedSources) {
      this.metricsService.recordExecutiveContextExcludedSource(excluded.source, excluded.reason);
    }
    await this.cacheContext(cacheKey, context, organizationId, userId, [
      `executive-context:tenant:${organizationId}`,
      `executive-context:user:${organizationId}:${userId}`,
      ...context.metadata.sourcesIncluded.flatMap((source) => [
        `executive-context:source:${organizationId}:${source}`,
        `executive-context:source:${organizationId}:${userId}:${source}`,
      ]),
    ]);
    this.metricsService.recordExecutiveContextAssemblyDuration(performance.now() - startedAt);
    return context;
  }

  invalidateForOrganization(organizationId: string): Promise<void> {
    return this.invalidationService.invalidateTenant(organizationId);
  }

  private permissionFingerprint(permissions: string[]): string {
    return [...new Set(permissions)].sort().join(',');
  }

  private async getCachedContext(
    key: string,
    tenantId: string,
    userId: string,
  ): Promise<ExecutiveContext | null> {
    try {
      return await this.cacheService.get<ExecutiveContext>(key);
    } catch (error) {
      this.logger.warn({ err: error, tenantId, userId }, 'Executive context cache read failed');
      return null;
    }
  }

  private async cacheContext(
    key: string,
    context: ExecutiveContext,
    tenantId: string,
    userId: string,
    tags: string[],
  ): Promise<void> {
    try {
      await this.cacheService.set(key, context, CONTEXT_TTL_MS, tags);
    } catch (error) {
      this.logger.warn({ err: error, tenantId, userId }, 'Executive context cache write failed');
    }
  }
}
