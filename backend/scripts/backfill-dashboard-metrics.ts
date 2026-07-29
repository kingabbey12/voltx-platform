/**
 * Seeds daily dashboard snapshots so trends and sparklines can be developed
 * and reviewed without waiting days for the nightly job to accumulate history.
 *
 *   pnpm dashboard:backfill           # today only
 *   pnpm dashboard:backfill -- 30     # today plus 29 prior days
 *
 * DEVELOPMENT ONLY. Deliberately separate from DashboardAggregationService and
 * its cron registration, so nothing here can run in production by accident.
 *
 * An important honesty caveat about backdated rows: the snapshot for a past day
 * is computed from the CURRENT state of the operational tables, because that is
 * the only information that still exists. It is therefore a flat line, not real
 * history — useful for exercising chart rendering, useless as data. Real
 * history only begins accumulating once the nightly job has run.
 *
 * That is why this refuses to touch a production database rather than quietly
 * writing plausible-looking numbers into one.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run in production: backdated rows are synthesised from current state, ' +
        'not real history. Let the nightly aggregation job build production history.',
    );
  }

  const days = Math.max(1, Number(process.argv[2] ?? 1));
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });

  if (organizations.length === 0) {
    console.log('No organizations found — nothing to backfill.');
    return;
  }

  let written = 0;

  for (const organization of organizations) {
    // Aggregate once per organization, then write it to each day. The values
    // are identical by construction, so re-querying per day would be wasted
    // work that also implied a precision the data does not have.
    const [counts, pipeline, won, activities] = await Promise.all([
      prisma.$queryRaw<
        { companies: bigint; contacts: bigint; leads: bigint; qualified: bigint }[]
      >`
        SELECT
          (SELECT COUNT(*) FROM "sales_companies" WHERE "organization_id" = ${organization.id}::uuid) AS companies,
          (SELECT COUNT(*) FROM "sales_contacts"  WHERE "organization_id" = ${organization.id}::uuid) AS contacts,
          (SELECT COUNT(*) FROM "sales_leads"     WHERE "organization_id" = ${organization.id}::uuid) AS leads,
          (SELECT COUNT(*) FROM "sales_leads"     WHERE "organization_id" = ${organization.id}::uuid
             AND "status" = 'QUALIFIED') AS qualified
      `,
      prisma.$queryRaw<{ total: unknown; open: bigint; all: bigint }[]>`
        SELECT
          COALESCE(SUM("amount") FILTER (WHERE "stage" NOT IN ('CLOSED_WON','CLOSED_LOST')), 0)::numeric AS total,
          COUNT(*) FILTER (WHERE "stage" NOT IN ('CLOSED_WON','CLOSED_LOST')) AS open,
          COUNT(*) AS all
        FROM "sales_opportunities" WHERE "organization_id" = ${organization.id}::uuid
      `,
      prisma.$queryRaw<{ total: unknown }[]>`
        SELECT COALESCE(SUM("amount"), 0)::numeric AS total
        FROM "sales_opportunities"
        WHERE "organization_id" = ${organization.id}::uuid AND "stage" = 'CLOSED_WON'
      `,
      prisma.$queryRaw<{ open: bigint }[]>`
        SELECT COUNT(*) AS open FROM "sales_activities"
        WHERE "organization_id" = ${organization.id}::uuid AND "completed" = false
      `,
    ]);

    const num = (value: unknown): number =>
      value === null || value === undefined ? 0 : Number(value);

    const base = {
      companies: num(counts[0]?.companies),
      contacts: num(counts[0]?.contacts),
      leads: num(counts[0]?.leads),
      qualifiedLeads: num(counts[0]?.qualified),
      opportunities: num(pipeline[0]?.all),
      openOpportunities: num(pipeline[0]?.open),
      openActivities: num(activities[0]?.open),
      pipelineValue: num(pipeline[0]?.total),
      wonValue: num(won[0]?.total),
    };

    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      const capturedOn = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
      );

      // Same upsert key the nightly job uses, so a backfilled day is replaced
      // by the real snapshot rather than duplicated once the job catches up.
      await prisma.dailyBusinessMetric.upsert({
        where: { organizationId_capturedOn: { organizationId: organization.id, capturedOn } },
        create: { organizationId: organization.id, capturedOn, ...base },
        update: base,
      });
      written += 1;
    }

    console.log(`  ${organization.name}: ${days} day(s), pipeline ${base.pipelineValue}`);
  }

  console.log(`Backfilled ${written} snapshot row(s) across ${organizations.length} organization(s).`);
  console.log('Note: backdated rows repeat current state — they are flat, not real history.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
