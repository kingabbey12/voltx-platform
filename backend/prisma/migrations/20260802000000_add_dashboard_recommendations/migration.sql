-- Durable, tenant-scoped Executive Dashboard recommendations. A fingerprint
-- deduplicates deterministic signals and action idempotency keys make retries
-- safe without trusting state supplied by the browser.

CREATE TYPE "DashboardRecommendationCategory" AS ENUM (
  'SALES', 'CUSTOMER', 'OPERATIONS', 'FINANCE', 'WORKFLOW', 'EXECUTIVE'
);

CREATE TYPE "DashboardRecommendationSeverity" AS ENUM (
  'INFO', 'OPPORTUNITY', 'WARNING', 'CRITICAL'
);

CREATE TYPE "DashboardRecommendationStatus" AS ENUM (
  'OPEN', 'APPROVED', 'EXECUTING', 'COMPLETED', 'DISMISSED', 'FAILED'
);

CREATE TYPE "DashboardRecommendationActionType" AS ENUM (
  'CREATE_TASK', 'OPEN_RECORD', 'DRAFT_EMAIL', 'RUN_WORKFLOW', 'DISMISS'
);

CREATE TABLE "dashboard_recommendations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'deterministic',
  "category" "DashboardRecommendationCategory" NOT NULL,
  "severity" "DashboardRecommendationSeverity" NOT NULL,
  "status" "DashboardRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "business_impact" TEXT NOT NULL,
  "recommended_next_step" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "stale_at" TIMESTAMP(3),
  "dismissed_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dashboard_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_recommendations_organization_id_fingerprint_key"
  ON "dashboard_recommendations"("organization_id", "fingerprint");
CREATE INDEX "dashboard_recommendations_organization_id_status_severity_idx"
  ON "dashboard_recommendations"("organization_id", "status", "severity");
CREATE INDEX "dashboard_recommendations_organization_id_expires_at_idx"
  ON "dashboard_recommendations"("organization_id", "expires_at");

ALTER TABLE "dashboard_recommendations"
  ADD CONSTRAINT "dashboard_recommendations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "dashboard_recommendation_actions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "type" "DashboardRecommendationActionType" NOT NULL,
  "label" TEXT NOT NULL,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotency_key" TEXT NOT NULL,
  "execution_started_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "result" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dashboard_recommendation_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_recommendation_actions_organization_id_idempotency_key_key"
  ON "dashboard_recommendation_actions"("organization_id", "idempotency_key");
CREATE INDEX "dashboard_recommendation_actions_organization_id_recommendation_id_idx"
  ON "dashboard_recommendation_actions"("organization_id", "recommendation_id");

ALTER TABLE "dashboard_recommendation_actions"
  ADD CONSTRAINT "dashboard_recommendation_actions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dashboard_recommendation_actions"
  ADD CONSTRAINT "dashboard_recommendation_actions_recommendation_id_fkey"
  FOREIGN KEY ("recommendation_id") REFERENCES "dashboard_recommendations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_activities"
  ADD COLUMN "recommendation_action_id" UUID;
CREATE UNIQUE INDEX "sales_activities_recommendation_action_id_key"
  ON "sales_activities"("recommendation_action_id");