-- VT-205 AI workflow plans.
--
-- Prisma's generated diff also contained drift-correction for indexes that
-- are created by hand in earlier migrations (the knowledge_chunks tsvector
-- and HNSW indexes) plus cosmetic index renames. Those are deliberately
-- omitted here: this migration contains only the VT-205 changes.

-- CreateEnum
CREATE TYPE "AiWorkflowPlanStatus" AS ENUM ('AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'HANDED_OFF');

-- AlterEnum: workflow plans reuse the existing approval framework, which
-- needs a cancelled state the tool-call flow never produced.
ALTER TYPE "AgentActionApprovalStatus" ADD VALUE 'CANCELLED';

-- AlterTable: allow a non-tool-call approval (a workflow plan) to live in
-- the same approvals table, inbox and decide endpoint.
ALTER TABLE "agent_action_approvals" ADD COLUMN     "resource_id" UUID,
ADD COLUMN     "resource_type" TEXT,
ALTER COLUMN "agent_run_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ai_workflow_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "plan_version" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "status" "AiWorkflowPlanStatus" NOT NULL DEFAULT 'AWAITING_APPROVAL',
    "approval_id" UUID,
    "workflow_id" UUID,
    "workflow_execution_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "handed_off_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_workflow_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_workflow_plans_organization_id_idx" ON "ai_workflow_plans"("organization_id");

-- CreateIndex
CREATE INDEX "ai_workflow_plans_organization_id_status_idx" ON "ai_workflow_plans"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ai_workflow_plans_approval_id_idx" ON "ai_workflow_plans"("approval_id");

-- CreateIndex
CREATE INDEX "ai_workflow_plans_expires_at_idx" ON "ai_workflow_plans"("expires_at");

-- CreateIndex
CREATE INDEX "ai_workflow_plans_deleted_at_idx" ON "ai_workflow_plans"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_workflow_plans_organization_id_user_id_plan_key_key" ON "ai_workflow_plans"("organization_id", "user_id", "plan_key");

-- CreateIndex
CREATE INDEX "agent_action_approvals_resource_type_resource_id_idx" ON "agent_action_approvals"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "ai_workflow_plans" ADD CONSTRAINT "ai_workflow_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workflow_plans" ADD CONSTRAINT "ai_workflow_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
