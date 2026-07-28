-- Analytical layer: one snapshot row per organization per day.
--
-- Hand-authored rather than generated, because the development database
-- carries migrations from another branch and `migrate dev` would have
-- insisted on resetting it.
--
-- Written once daily by the aggregation job and read on every dashboard load,
-- so the index is on the exact lookup shape: an organization's rows over a
-- date window, newest first.

CREATE TABLE "daily_business_metrics" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "captured_on" DATE NOT NULL,

  "companies" INTEGER NOT NULL DEFAULT 0,
  "contacts" INTEGER NOT NULL DEFAULT 0,
  "leads" INTEGER NOT NULL DEFAULT 0,
  "qualified_leads" INTEGER NOT NULL DEFAULT 0,
  "opportunities" INTEGER NOT NULL DEFAULT 0,
  "open_opportunities" INTEGER NOT NULL DEFAULT 0,
  "open_activities" INTEGER NOT NULL DEFAULT 0,

  -- Decimal, not double precision: this is money on an executive dashboard.
  "pipeline_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "won_value" DECIMAL(18,2) NOT NULL DEFAULT 0,

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_business_metrics_pkey" PRIMARY KEY ("id")
);

-- One row per organization per day. Also the conflict target that makes the
-- aggregation job idempotent, so a re-run backfills rather than duplicates.
CREATE UNIQUE INDEX "daily_business_metrics_organization_id_captured_on_key"
  ON "daily_business_metrics"("organization_id", "captured_on");

CREATE INDEX "daily_business_metrics_organization_id_captured_on_idx"
  ON "daily_business_metrics"("organization_id", "captured_on" DESC);

ALTER TABLE "daily_business_metrics"
  ADD CONSTRAINT "daily_business_metrics_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
