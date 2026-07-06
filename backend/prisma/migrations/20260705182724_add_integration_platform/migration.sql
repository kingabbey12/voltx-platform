-- CreateEnum
CREATE TYPE "IntegrationProviderKey" AS ENUM ('GOOGLE_GMAIL', 'GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'MICROSOFT_OUTLOOK', 'MICROSOFT_CALENDAR', 'MICROSOFT_ONEDRIVE', 'SLACK', 'MICROSOFT_TEAMS', 'GITHUB', 'STRIPE', 'WEBHOOK', 'REST_API');

-- CreateEnum
CREATE TYPE "IntegrationAuthType" AS ENUM ('OAUTH2', 'API_KEY', 'WEBHOOK_SECRET', 'NONE');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'REVOKED', 'TOKEN_EXPIRED');

-- CreateEnum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IntegrationSyncTrigger" AS ENUM ('MANUAL', 'POLL', 'WEBHOOK', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "IntegrationEventType" AS ENUM ('EMAIL_RECEIVED', 'MEETING_CREATED', 'FILE_UPLOADED', 'PAYMENT_RECEIVED', 'SLACK_MESSAGE', 'TEAMS_MESSAGE', 'GITHUB_ISSUE', 'WEBHOOK_RECEIVED', 'API_EVENT', 'CONNECTION_CONNECTED', 'CONNECTION_ERROR', 'TOKEN_REFRESHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeSourceType" ADD VALUE 'MESSAGE';
ALTER TYPE "KnowledgeSourceType" ADD VALUE 'ISSUE';

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "IntegrationProviderKey" NOT NULL,
    "display_name" TEXT NOT NULL,
    "auth_type" "IntegrationAuthType" NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "external_account_id" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "last_health_check_at" TIMESTAMP(3),
    "last_health_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_endpoints" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "IntegrationProviderKey" NOT NULL,
    "token" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "type" "IntegrationEventType" NOT NULL,
    "external_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "trigger" "IntegrationSyncTrigger" NOT NULL,
    "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_api_usage_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "rate_limit_remaining" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_health_checks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "status" "IntegrationHealthStatus" NOT NULL,
    "latency_ms" INTEGER,
    "message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_connections_organization_id_idx" ON "integration_connections"("organization_id");

-- CreateIndex
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections"("provider");

-- CreateIndex
CREATE INDEX "integration_connections_status_idx" ON "integration_connections"("status");

-- CreateIndex
CREATE INDEX "integration_connections_deleted_at_idx" ON "integration_connections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_organization_id_provider_external_a_key" ON "integration_connections"("organization_id", "provider", "external_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_connection_id_key" ON "integration_credentials"("connection_id");

-- CreateIndex
CREATE INDEX "integration_credentials_organization_id_idx" ON "integration_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "integration_credentials_expires_at_idx" ON "integration_credentials"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_webhook_endpoints_token_key" ON "integration_webhook_endpoints"("token");

-- CreateIndex
CREATE INDEX "integration_webhook_endpoints_connection_id_idx" ON "integration_webhook_endpoints"("connection_id");

-- CreateIndex
CREATE INDEX "integration_webhook_endpoints_organization_id_idx" ON "integration_webhook_endpoints"("organization_id");

-- CreateIndex
CREATE INDEX "integration_events_organization_id_idx" ON "integration_events"("organization_id");

-- CreateIndex
CREATE INDEX "integration_events_connection_id_idx" ON "integration_events"("connection_id");

-- CreateIndex
CREATE INDEX "integration_events_type_idx" ON "integration_events"("type");

-- CreateIndex
CREATE INDEX "integration_events_created_at_idx" ON "integration_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_events_connection_id_external_id_key" ON "integration_events"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "integration_sync_runs_organization_id_idx" ON "integration_sync_runs"("organization_id");

-- CreateIndex
CREATE INDEX "integration_sync_runs_connection_id_idx" ON "integration_sync_runs"("connection_id");

-- CreateIndex
CREATE INDEX "integration_sync_runs_status_idx" ON "integration_sync_runs"("status");

-- CreateIndex
CREATE INDEX "integration_sync_runs_created_at_idx" ON "integration_sync_runs"("created_at");

-- CreateIndex
CREATE INDEX "integration_api_usage_logs_organization_id_idx" ON "integration_api_usage_logs"("organization_id");

-- CreateIndex
CREATE INDEX "integration_api_usage_logs_connection_id_idx" ON "integration_api_usage_logs"("connection_id");

-- CreateIndex
CREATE INDEX "integration_api_usage_logs_created_at_idx" ON "integration_api_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "integration_health_checks_connection_id_idx" ON "integration_health_checks"("connection_id");

-- CreateIndex
CREATE INDEX "integration_health_checks_checked_at_idx" ON "integration_health_checks"("checked_at");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_webhook_endpoints" ADD CONSTRAINT "integration_webhook_endpoints_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_api_usage_logs" ADD CONSTRAINT "integration_api_usage_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_health_checks" ADD CONSTRAINT "integration_health_checks_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
