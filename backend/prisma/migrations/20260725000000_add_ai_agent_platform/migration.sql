-- AI Agent Platform: versioning + publish workflow, per-agent tool
-- allowlist, cron/event scheduling, workflow linkage, and agent-scoped
-- memory with TTL retention.
--
-- Purely additive/relational — no vector columns, no changes to the
-- existing knowledge_chunks pgvector/tsvector indexes from
-- 20260724000000_add_knowledge_rag_extensions. All new columns on
-- existing tables (agents, agent_runs, memories) are nullable or
-- DEFAULTed, so every pre-existing row gets a value automatically:
--   agents.status              -> 'PUBLISHED' (every existing agent, incl.
--                                  the 10 hardcoded system agents, stays
--                                  runnable exactly as before)
--   agents.latest_version      -> 0
--   agent_runs.trigger_type    -> 'MANUAL'
--   agent_runs.attempt_number  -> 1
--   memories.scope             -> 'CONVERSATION' (existing rows keep their
--                                  current meaning unchanged)
-- No AgentVersion rows are backfilled for existing agents: publishedVersionId
-- stays null for all of them, which is the correct "never published a
-- version yet" state (see AgentFactory/AgentExecutor's JSON-blob fallback).

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'EVENT');

-- CreateEnum
CREATE TYPE "AgentScheduleTriggerType" AS ENUM ('CRON', 'EVENT');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('CONVERSATION', 'LONG_TERM', 'WORKING', 'SESSION');

-- AlterTable: agents
ALTER TABLE "agents"
  ADD COLUMN "status" "AgentStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "published_version_id" UUID,
  ADD COLUMN "latest_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: agent_runs
ALTER TABLE "agent_runs"
  ADD COLUMN "agent_version_id" UUID,
  ADD COLUMN "trigger_type" "AgentTriggerType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "schedule_id" UUID,
  ADD COLUMN "attempt_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: memories
ALTER TABLE "memories"
  ADD COLUMN "agent_id" UUID,
  ADD COLUMN "scope" "MemoryScope" NOT NULL DEFAULT 'CONVERSATION',
  ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateTable: agent_versions
CREATE TABLE "agent_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "max_tokens" INTEGER,
    "prompt_id" UUID,
    "knowledge_collection_id" UUID,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_tools
CREATE TABLE "agent_tools" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agent_version_id" UUID,
    "tool_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_schedules
CREATE TABLE "agent_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agent_version_id" UUID,
    "trigger_type" "AgentScheduleTriggerType" NOT NULL,
    "cron_expression" TEXT,
    "event_name" TEXT,
    "input" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_workflow_links
CREATE TABLE "agent_workflow_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "step_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_workflow_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");
CREATE INDEX "agent_runs_agent_version_id_idx" ON "agent_runs"("agent_version_id");
CREATE INDEX "agent_runs_schedule_id_idx" ON "agent_runs"("schedule_id");
CREATE INDEX "agent_runs_trigger_type_idx" ON "agent_runs"("trigger_type");
CREATE INDEX "memories_agent_id_idx" ON "memories"("agent_id");
CREATE INDEX "memories_scope_idx" ON "memories"("scope");
CREATE INDEX "memories_expires_at_idx" ON "memories"("expires_at");

CREATE INDEX "agent_versions_organization_id_idx" ON "agent_versions"("organization_id");
CREATE INDEX "agent_versions_agent_id_idx" ON "agent_versions"("agent_id");
CREATE UNIQUE INDEX "agent_versions_agent_id_version_key" ON "agent_versions"("agent_id", "version");

CREATE INDEX "agent_tools_organization_id_idx" ON "agent_tools"("organization_id");
CREATE INDEX "agent_tools_agent_id_idx" ON "agent_tools"("agent_id");
CREATE INDEX "agent_tools_agent_version_id_idx" ON "agent_tools"("agent_version_id");
CREATE UNIQUE INDEX "agent_tools_agent_id_agent_version_id_tool_name_key" ON "agent_tools"("agent_id", "agent_version_id", "tool_name");

CREATE INDEX "agent_schedules_organization_id_idx" ON "agent_schedules"("organization_id");
CREATE INDEX "agent_schedules_agent_id_idx" ON "agent_schedules"("agent_id");
CREATE INDEX "agent_schedules_trigger_type_idx" ON "agent_schedules"("trigger_type");
CREATE INDEX "agent_schedules_enabled_idx" ON "agent_schedules"("enabled");
CREATE INDEX "agent_schedules_next_run_at_idx" ON "agent_schedules"("next_run_at");

CREATE INDEX "agent_workflow_links_organization_id_idx" ON "agent_workflow_links"("organization_id");
CREATE INDEX "agent_workflow_links_workflow_id_idx" ON "agent_workflow_links"("workflow_id");
CREATE INDEX "agent_workflow_links_agent_id_idx" ON "agent_workflow_links"("agent_id");
CREATE UNIQUE INDEX "agent_workflow_links_workflow_id_step_key_key" ON "agent_workflow_links"("workflow_id", "step_key");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "agent_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_schedules" ADD CONSTRAINT "agent_schedules_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_schedules" ADD CONSTRAINT "agent_schedules_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_workflow_links" ADD CONSTRAINT "agent_workflow_links_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_workflow_links" ADD CONSTRAINT "agent_workflow_links_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
