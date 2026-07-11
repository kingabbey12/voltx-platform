-- The three statements above (DROP INDEX x2 + ALTER COLUMN ... DROP
-- DEFAULT on knowledge_chunks) are stripped here — they're a known
-- false-positive from Prisma's migration-diff engine reacting to the
-- Unsupported("vector(1536)")/generated-column fields on KnowledgeChunk
-- (content_tsv is a real Postgres GENERATED column; Postgres rejects
-- "ALTER COLUMN ... DROP DEFAULT" on it with "is a generated column").
-- Same precedent already documented in
-- 20260710023757_add_attachments/migration.sql and
-- 20260710214650_add_ai_operator_approvals_suggestions_memory_embedding/migration.sql.

-- CreateTable
CREATE TABLE "background_job_failures" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "queue_name" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT NOT NULL,
    "attempts_made" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "background_job_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "background_job_failures_organization_id_idx" ON "background_job_failures"("organization_id");

-- CreateIndex
CREATE INDEX "background_job_failures_queue_name_idx" ON "background_job_failures"("queue_name");

-- CreateIndex
CREATE INDEX "background_job_failures_created_at_idx" ON "background_job_failures"("created_at");
