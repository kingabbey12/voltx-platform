-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('AGENT', 'TOOL', 'API', 'WEBHOOK', 'NOTIFICATION', 'APPROVAL', 'DELAY');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'IMMEDIATE', 'DELAYED', 'CRON', 'EVENT', 'API');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "WorkflowStepRunStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "WorkflowApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkflowLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "published_version" INTEGER,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "cron_expression" TEXT,
    "delay_ms" INTEGER,
    "event_name" TEXT,
    "input" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "context" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "current_step_id" TEXT,
    "idempotency_key" TEXT,
    "triggered_by" UUID,
    "error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "step_id" TEXT NOT NULL,
    "type" "WorkflowStepType" NOT NULL,
    "status" "WorkflowStepRunStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_retry_attempts" (
    "id" UUID NOT NULL,
    "step_run_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "error" TEXT NOT NULL,
    "delay_ms" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_retry_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "step_run_id" UUID,
    "level" "WorkflowLogLevel" NOT NULL DEFAULT 'INFO',
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_checkpoints" (
    "id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "step_id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "step_run_id" UUID NOT NULL,
    "status" "WorkflowApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approver_user_id" UUID,
    "comment" TEXT,
    "expires_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_dead_letters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "step_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_organization_id_idx" ON "workflows"("organization_id");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_deleted_at_idx" ON "workflows"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_organization_id_name_key" ON "workflows"("organization_id", "name");

-- CreateIndex
CREATE INDEX "workflow_versions_organization_id_idx" ON "workflow_versions"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_key" ON "workflow_versions"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "workflow_schedules_organization_id_idx" ON "workflow_schedules"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_schedules_workflow_id_idx" ON "workflow_schedules"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_schedules_trigger_type_idx" ON "workflow_schedules"("trigger_type");

-- CreateIndex
CREATE INDEX "workflow_schedules_enabled_idx" ON "workflow_schedules"("enabled");

-- CreateIndex
CREATE INDEX "workflow_schedules_next_run_at_idx" ON "workflow_schedules"("next_run_at");

-- CreateIndex
CREATE INDEX "workflow_runs_organization_id_idx" ON "workflow_runs"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_version_id_idx" ON "workflow_runs"("workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_created_at_idx" ON "workflow_runs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflow_id_idempotency_key_key" ON "workflow_runs"("workflow_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "workflow_step_runs_organization_id_idx" ON "workflow_step_runs"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_step_runs_workflow_run_id_idx" ON "workflow_step_runs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_step_runs_status_idx" ON "workflow_step_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_runs_workflow_run_id_step_id_key" ON "workflow_step_runs"("workflow_run_id", "step_id");

-- CreateIndex
CREATE INDEX "workflow_retry_attempts_step_run_id_idx" ON "workflow_retry_attempts"("step_run_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_workflow_run_id_idx" ON "workflow_execution_logs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_step_run_id_idx" ON "workflow_execution_logs"("step_run_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_created_at_idx" ON "workflow_execution_logs"("created_at");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_workflow_run_id_idx" ON "workflow_checkpoints"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_created_at_idx" ON "workflow_checkpoints"("created_at");

-- CreateIndex
CREATE INDEX "workflow_approvals_organization_id_idx" ON "workflow_approvals"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_approvals_workflow_run_id_idx" ON "workflow_approvals"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_approvals_step_run_id_idx" ON "workflow_approvals"("step_run_id");

-- CreateIndex
CREATE INDEX "workflow_approvals_status_idx" ON "workflow_approvals"("status");

-- CreateIndex
CREATE INDEX "workflow_dead_letters_organization_id_idx" ON "workflow_dead_letters"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_dead_letters_workflow_run_id_idx" ON "workflow_dead_letters"("workflow_run_id");

-- CreateIndex
CREATE INDEX "workflow_dead_letters_created_at_idx" ON "workflow_dead_letters"("created_at");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_retry_attempts" ADD CONSTRAINT "workflow_retry_attempts_step_run_id_fkey" FOREIGN KEY ("step_run_id") REFERENCES "workflow_step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_checkpoints" ADD CONSTRAINT "workflow_checkpoints_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_step_run_id_fkey" FOREIGN KEY ("step_run_id") REFERENCES "workflow_step_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_dead_letters" ADD CONSTRAINT "workflow_dead_letters_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
