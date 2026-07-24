-- Prompt Management: versioned, org-owned prompts resolved and rendered by the
-- AI Gateway. Hand-written to avoid the knowledge_chunks pgvector/tsvector
-- drift artifacts Prisma regenerates, per the convention since
-- 20260705093948_add_knowledge_graph_rag.

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "prompts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "published_version_id" UUID,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "provider" TEXT,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_test_runs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "prompt_version_id" UUID,
    "organization_id" UUID NOT NULL,
    "rendered_prompt" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "model" TEXT,
    "provider" TEXT,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_usd" DECIMAL(12,6),
    "response" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompts_organization_id_idx" ON "prompts"("organization_id");
CREATE INDEX "prompts_status_idx" ON "prompts"("status");
CREATE INDEX "prompts_category_idx" ON "prompts"("category");
CREATE INDEX "prompts_deleted_at_idx" ON "prompts"("deleted_at");
CREATE UNIQUE INDEX "prompts_organization_id_key_key" ON "prompts"("organization_id", "key");

-- CreateIndex
CREATE INDEX "prompt_versions_prompt_id_idx" ON "prompt_versions"("prompt_id");
CREATE INDEX "prompt_versions_organization_id_idx" ON "prompt_versions"("organization_id");
CREATE UNIQUE INDEX "prompt_versions_prompt_id_version_key" ON "prompt_versions"("prompt_id", "version");

-- CreateIndex
CREATE INDEX "prompt_test_runs_prompt_id_idx" ON "prompt_test_runs"("prompt_id");
CREATE INDEX "prompt_test_runs_organization_id_idx" ON "prompt_test_runs"("organization_id");
CREATE INDEX "prompt_test_runs_created_at_idx" ON "prompt_test_runs"("created_at");

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_test_runs" ADD CONSTRAINT "prompt_test_runs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_test_runs" ADD CONSTRAINT "prompt_test_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
