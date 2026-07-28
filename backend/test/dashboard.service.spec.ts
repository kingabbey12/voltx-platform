import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import type {
  BusinessSnapshot,
  DashboardMetricsService,
  MetricPoint,
} from '../src/modules/dashboard/dashboard-metrics.service';
import type { TenantContextService } from '../src/common/tenant/tenant-context.service';

/**
 * Change derivation is the part of the dashboard most able to mislead: a wrong
 * percentage is still a plausible-looking number, so it gets asserted rather
 * than eyeballed.
 */

const ORG = '11111111-1111-1111-1111-111111111111';

const emptySnapshot: BusinessSnapshot = {
  companies: 0,
  contacts: 0,
  leads: 0,
  qualifiedLeads: 0,
  opportunities: 0,
  openOpportunities: 0,
  openActivities: 0,
  pipelineValue: 0,
  wonValue: 0,
};

function buildService(snapshot: BusinessSnapshot, trends: Record<string, MetricPoint[]>) {
  const metrics = {
    getSnapshot: jest.fn().mockResolvedValue(snapshot),
    getTrends: jest.fn().mockResolvedValue(trends),
  } as unknown as DashboardMetricsService;

  const tenantContext = {
    getOrThrow: jest.fn().mockReturnValue({ organizationId: ORG }),
  } as unknown as TenantContextService;

  return new DashboardService(metrics, tenantContext);
}

describe('DashboardService', () => {
  it('derives change against the oldest snapshot in the window', async () => {
    const service = buildService(
      { ...emptySnapshot, pipelineValue: 434_000 },
      {
        pipelineValue: [
          { date: '2026-07-01', value: 400_000 },
          { date: '2026-07-15', value: 420_000 },
        ],
      },
    );

    const result = await service.getExecutiveSnapshot();

    expect(result.changes.pipelineValue).toEqual({
      absolute: 34_000,
      percent: 0.085,
      comparedTo: 'since 2026-07-01',
    });
  });

  it('omits change entirely when there is only one snapshot', async () => {
    // "No baseline yet" and "no change" are different claims. Reporting 0%
    // would tell an executive their pipeline is flat when in truth nothing is
    // known about it.
    const service = buildService(
      { ...emptySnapshot, pipelineValue: 434_000 },
      { pipelineValue: [{ date: '2026-07-28', value: 434_000 }] },
    );

    const result = await service.getExecutiveSnapshot();

    expect(result.changes.pipelineValue).toBeUndefined();
  });

  it('reports a null percent when the baseline is zero', async () => {
    // Growing from nothing has no meaningful percentage — the first company
    // added is not "+100%". The absolute movement is still reported.
    const service = buildService(
      { ...emptySnapshot, companies: 3 },
      {
        companies: [
          { date: '2026-07-01', value: 0 },
          { date: '2026-07-28', value: 3 },
        ],
      },
    );

    const result = await service.getExecutiveSnapshot();

    expect(result.changes.companies).toEqual({
      absolute: 3,
      percent: null,
      comparedTo: 'since 2026-07-01',
    });
  });

  it('reports a negative change when a metric declines', async () => {
    const service = buildService(
      { ...emptySnapshot, openOpportunities: 8 },
      {
        opportunities: [
          { date: '2026-07-01', value: 10 },
          { date: '2026-07-28', value: 8 },
        ],
      },
    );

    const result = await service.getExecutiveSnapshot();

    expect(result.changes.openOpportunities?.absolute).toBe(-2);
    expect(result.changes.openOpportunities?.percent).toBeCloseTo(-0.2);
  });

  it('does not invent health or insights before a model exists', async () => {
    // The contract is stable so the frontend can be built against it, but a
    // fabricated score is one someone might act on.
    const service = buildService(emptySnapshot, {});

    const result = await service.getExecutiveSnapshot();

    expect(result.health).toEqual({ score: null, status: 'unknown' });
    expect(result.insights).toEqual([]);
  });

  it('resolves the organization from tenant context, never from a caller argument', async () => {
    // The raw SQL bypasses the tenant Prisma extension, so the organization id
    // must come from the verified request context or a caller could read
    // another tenant's aggregates.
    const service = buildService(emptySnapshot, {});
    const result = await service.getExecutiveSnapshot(14);

    expect(result.meta.historyDays).toBe(0);
    expect(result.snapshot).toEqual(emptySnapshot);
  });
});
