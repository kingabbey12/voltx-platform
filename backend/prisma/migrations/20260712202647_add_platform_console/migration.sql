-- CreateEnum
CREATE TYPE "PlatformAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PlatformAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FeatureFlagType" AS ENUM ('BOOLEAN', 'STRING', 'NUMBER', 'JSON');

-- CreateTable
CREATE TABLE "platform_alerts" (
    "id" UUID NOT NULL,
    "severity" "PlatformAlertSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "status" "PlatformAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_metadata" JSONB NOT NULL DEFAULT '{}',
    "organization_id" UUID,
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FeatureFlagType" NOT NULL DEFAULT 'BOOLEAN',
    "default_value" JSONB NOT NULL,
    "organization_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_alerts_status_idx" ON "platform_alerts"("status");

-- CreateIndex
CREATE INDEX "platform_alerts_severity_idx" ON "platform_alerts"("severity");

-- CreateIndex
CREATE INDEX "platform_alerts_category_idx" ON "platform_alerts"("category");

-- CreateIndex
CREATE INDEX "platform_alerts_organization_id_idx" ON "platform_alerts"("organization_id");

-- CreateIndex
CREATE INDEX "platform_alerts_created_at_idx" ON "platform_alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
