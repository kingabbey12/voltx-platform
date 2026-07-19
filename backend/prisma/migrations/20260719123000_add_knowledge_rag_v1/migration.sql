-- Production RAG v1: async ingestion jobs + rerank latency observability.
-- NOTE: Hand-authored migration to avoid Prisma diff false-positives around
-- knowledge_chunks generated/vector columns.

-- CreateEnum
CREATE TYPE "KnowledgeIngestionJobStatus" AS ENUM (
  'QUEUED',
  'EXTRACTING',
  'CHUNKING',
  'EMBEDDING',
  'INDEXING',
  'READY',
  'FAILED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "knowledge_ingestion_jobs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "document_id" UUID,
  "requested_by_user_id" UUID NOT NULL,
  "requested_by_membership_id" UUID NOT NULL,
  "status" "KnowledgeIngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress_percent" INTEGER NOT NULL DEFAULT 0,
  "attempts_made" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "resume_from_job_id" UUID,
  "cancellation_requested_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "knowledge_ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "knowledge_search_logs" ADD COLUMN "rerank_latency_ms" INTEGER;

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_organization_id_idx" ON "knowledge_ingestion_jobs"("organization_id");
CREATE INDEX "knowledge_ingestion_jobs_source_id_idx" ON "knowledge_ingestion_jobs"("source_id");
CREATE INDEX "knowledge_ingestion_jobs_document_id_idx" ON "knowledge_ingestion_jobs"("document_id");
CREATE INDEX "knowledge_ingestion_jobs_status_idx" ON "knowledge_ingestion_jobs"("status");
CREATE INDEX "knowledge_ingestion_jobs_created_at_idx" ON "knowledge_ingestion_jobs"("created_at");
CREATE INDEX "knowledge_ingestion_jobs_cancellation_requested_at_idx" ON "knowledge_ingestion_jobs"("cancellation_requested_at");

-- AddForeignKey
ALTER TABLE "knowledge_ingestion_jobs"
  ADD CONSTRAINT "knowledge_ingestion_jobs_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_ingestion_jobs"
  ADD CONSTRAINT "knowledge_ingestion_jobs_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
