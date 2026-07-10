-- CreateEnum
CREATE TYPE "AgentActionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiSuggestionCategory" AS ENUM ('SALES', 'SUPPORT', 'OPERATIONS', 'FINANCE', 'GENERAL');

-- AlterEnum
ALTER TYPE "AgentRunStatus" ADD VALUE 'WAITING_APPROVAL';

-- Note: Prisma's migrate-diff engine again proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here —
-- same unrelated tooling noise already documented and removed in
-- 20260710023757_add_attachments/migration.sql (it can't fully reason
-- about the raw-SQL GENERATED/vector columns modeled as Unsupported(...)
-- in schema.prisma). Removed again to avoid dropping a real search index.

-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "embedding" vector(1536);

-- CreateTable
CREATE TABLE "agent_action_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "status" "AgentActionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approver_user_id" UUID,
    "comment" TEXT,
    "expires_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_action_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category" "AiSuggestionCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_action_approvals_organization_id_idx" ON "agent_action_approvals"("organization_id");

-- CreateIndex
CREATE INDEX "agent_action_approvals_agent_run_id_idx" ON "agent_action_approvals"("agent_run_id");

-- CreateIndex
CREATE INDEX "agent_action_approvals_status_idx" ON "agent_action_approvals"("status");

-- CreateIndex
CREATE INDEX "ai_suggestions_organization_id_dismissed_at_idx" ON "ai_suggestions"("organization_id", "dismissed_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_created_at_idx" ON "ai_suggestions"("created_at");

-- AddForeignKey
ALTER TABLE "agent_action_approvals" ADD CONSTRAINT "agent_action_approvals_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
