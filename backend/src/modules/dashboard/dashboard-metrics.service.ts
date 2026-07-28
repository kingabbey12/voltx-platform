import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * The analytical layer.
 *
 * Deliberately isolated from the CRUD modules. Those own transactional writes
 * for one record at a time; this owns aggregates across many, and the two have
 * opposite performance characteristics. Keeping them apart is what allows
 * forecasting, anomaly detection and benchmarking to be added later without
 * reaching into the operational APIs.
 *
 * Two rules this service exists to enforce:
 *
 *   1. Aggregate in SQL, never in JavaScript. The dashboard previously summed
 *      pipeline by fetching the first 100 opportunities and adding them up in
 *      the browser, which silently undercounted any workspace with more than
 *      100 open deals. A SUM() over an indexed column is both correct and
 *      cheaper than shipping the rows.
 *
 *   2. Read history, never recompute it. Yesterday's pipeline cannot be
 *      derived from today's rows — a deleted opportunity leaves no trace and an
 *      edited amount rewrites the past. History comes from the daily snapshot
 *      table or it does not exist.
 */

export interface BusinessSnapshot {
  companies: number;
  contacts: number;
  leads: number;
  qualifiedLeads: number;
  opportunities: number;
  openOpportunities: number;
  openActivities: number;
  pipelineValue: number;
  wonValue: number;
}

export interface MetricPoint {
  /** ISO date, e.g. "2026-07-29". */
  date: string;
  value: number;
}

@Injectable()
export class DashboardMetricsService {
  private readonly logger = new Logger(DashboardMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Current totals for one organization, computed entirely in the database.
   *
   * Single round trip: eight aggregates issued together rather than eight
   * sequential awaits, because the dashboard blocks on the slowest one.
   *
   * `organizationId` is passed explicitly rather than relying on the tenant
   * Prisma extension, because $queryRaw bypasses that extension entirely —
   * raw SQL must always filter on the organization itself or it would read
   * across tenants.
   */
  async getSnapshot(organizationId: string): Promise<BusinessSnapshot> {
    const [counts, pipeline, won, activities] = await Promise.all([
      this.prisma.replica.$queryRaw<
        { companies: bigint; contacts: bigint; leads: bigint; qualified: bigint }[]
      >`
        SELECT
          (SELECT COUNT(*) FROM "sales_companies"  WHERE "organization_id" = ${organizationId}::uuid) AS companies,
          (SELECT COUNT(*) FROM "sales_contacts"   WHERE "organization_id" = ${organizationId}::uuid) AS contacts,
          (SELECT COUNT(*) FROM "sales_leads"      WHERE "organization_id" = ${organizationId}::uuid) AS leads,
          (SELECT COUNT(*) FROM "sales_leads"      WHERE "organization_id" = ${organizationId}::uuid
             AND "status" = 'QUALIFIED') AS qualified
      `,
      // The bug fix. COALESCE because SUM over no rows is NULL, not 0 — an
      // empty workspace would otherwise surface as null and render as blank.
      this.prisma.replica.$queryRaw<{ total: Prisma.Decimal | null; open: bigint; all: bigint }[]>`
        SELECT
          COALESCE(SUM("amount") FILTER (
            WHERE "stage" NOT IN ('CLOSED_WON', 'CLOSED_LOST')
          ), 0)::numeric AS total,
          COUNT(*) FILTER (WHERE "stage" NOT IN ('CLOSED_WON', 'CLOSED_LOST')) AS open,
          COUNT(*) AS all
        FROM "sales_opportunities"
        WHERE "organization_id" = ${organizationId}::uuid
      `,
      this.prisma.replica.$queryRaw<{ total: Prisma.Decimal | null }[]>`
        SELECT COALESCE(SUM("amount"), 0)::numeric AS total
        FROM "sales_opportunities"
        WHERE "organization_id" = ${organizationId}::uuid
          AND "stage" = 'CLOSED_WON'
      `,
      this.prisma.replica.$queryRaw<{ open: bigint }[]>`
        SELECT COUNT(*) AS open
        FROM "sales_activities"
        WHERE "organization_id" = ${organizationId}::uuid
          AND "completed" = false
      `,
    ]);

    return {
      companies: this.toNumber(counts[0]?.companies),
      contacts: this.toNumber(counts[0]?.contacts),
      leads: this.toNumber(counts[0]?.leads),
      qualifiedLeads: this.toNumber(counts[0]?.qualified),
      opportunities: this.toNumber(pipeline[0]?.all),
      openOpportunities: this.toNumber(pipeline[0]?.open),
      openActivities: this.toNumber(activities[0]?.open),
      pipelineValue: this.toNumber(pipeline[0]?.total),
      wonValue: this.toNumber(won[0]?.total),
    };
  }

  /**
   * Historical series from the snapshot table, oldest first.
   *
   * Returns whatever exists. A workspace created yesterday has one point, and
   * the frontend renders no sparkline rather than a misleading two-point line —
   * that decision belongs to the component, not here.
   */
  async getTrends(organizationId: string, days = 30): Promise<Record<string, MetricPoint[]>> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const rows = await this.prisma.replica.dailyBusinessMetric.findMany({
      where: { organizationId, capturedOn: { gte: since } },
      orderBy: { capturedOn: 'asc' },
    });

    const series = (pick: (row: (typeof rows)[number]) => Prisma.Decimal | number): MetricPoint[] =>
      rows.map((row) => ({
        date: row.capturedOn.toISOString().slice(0, 10),
        value: this.toNumber(pick(row)),
      }));

    return {
      companies: series((row) => row.companies),
      contacts: series((row) => row.contacts),
      opportunities: series((row) => row.openOpportunities),
      qualifiedLeads: series((row) => row.qualifiedLeads),
      pipelineValue: series((row) => row.pipelineValue),
      wonValue: series((row) => row.wonValue),
    };
  }

  /**
   * Writes today's snapshot. Idempotent on (organizationId, capturedOn), so
   * re-running backfills the day rather than duplicating it — which matters
   * because a retried job must not corrupt history.
   */
  async captureDailySnapshot(organizationId: string, when = new Date()): Promise<void> {
    const capturedOn = new Date(
      Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()),
    );
    const snapshot = await this.getSnapshot(organizationId);

    const data = {
      companies: snapshot.companies,
      contacts: snapshot.contacts,
      leads: snapshot.leads,
      qualifiedLeads: snapshot.qualifiedLeads,
      opportunities: snapshot.opportunities,
      openOpportunities: snapshot.openOpportunities,
      openActivities: snapshot.openActivities,
      pipelineValue: new Prisma.Decimal(snapshot.pipelineValue),
      wonValue: new Prisma.Decimal(snapshot.wonValue),
    };

    await this.prisma.system.dailyBusinessMetric.upsert({
      where: { organizationId_capturedOn: { organizationId, capturedOn } },
      create: { organizationId, capturedOn, ...data },
      update: data,
    });

    this.logger.debug(
      `Captured daily metrics for ${organizationId} on ${capturedOn.toISOString()}`,
    );
  }

  /** COUNT() returns bigint and SUM(numeric) a Decimal; both need narrowing. */
  private toNumber(value: bigint | Prisma.Decimal | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    return value.toNumber();
  }
}
