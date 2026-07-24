-- Knowledge & RAG extensions: collections (retrieval grouping), an ingestion
-- job pipeline (async upload/parse/chunk/embed/index behind a queue), and
-- embedding provenance/checksum on chunks for dedup. Hand-written to match the
-- knowledge module's existing convention (knowledge_chunks carries pgvector +
-- generated tsvector columns Prisma cannot diff cleanly).

-- CreateEnum
CREATE TYPE "KnowledgeCollectionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "KnowledgeJobType" AS ENUM ('INGEST_DOCUMENT', 'REINDEX_DOCUMENT', 'REINDEX_SOURCE', 'DELETE_DOCUMENT');
CREATE TYPE "KnowledgeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "KnowledgeJobStage" AS ENUM ('QUEUED', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'DONE');

-- CreateTable
CREATE TABLE "knowledge_collections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "KnowledgeCollectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_collections_organization_id_idx" ON "knowledge_collections"("organization_id");
CREATE INDEX "knowledge_collections_status_idx" ON "knowledge_collections"("status");
CREATE INDEX "knowledge_collections_deleted_at_idx" ON "knowledge_collections"("deleted_at");
CREATE UNIQUE INDEX "knowledge_collections_organization_id_name_key" ON "knowledge_collections"("organization_id", "name");

-- CreateTable
CREATE TABLE "knowledge_ingestion_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "KnowledgeJobType" NOT NULL,
    "status" "KnowledgeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "KnowledgeJobStage" NOT NULL DEFAULT 'QUEUED',
    "document_id" UUID,
    "source_id" UUID,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_by_membership_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_organization_id_idx" ON "knowledge_ingestion_jobs"("organization_id");
CREATE INDEX "knowledge_ingestion_jobs_status_idx" ON "knowledge_ingestion_jobs"("status");
CREATE INDEX "knowledge_ingestion_jobs_type_idx" ON "knowledge_ingestion_jobs"("type");
CREATE INDEX "knowledge_ingestion_jobs_created_at_idx" ON "knowledge_ingestion_jobs"("created_at");

-- AlterTable: knowledge_documents gains an optional collection
ALTER TABLE "knowledge_documents" ADD COLUMN "collection_id" UUID;
CREATE INDEX "knowledge_documents_collection_id_idx" ON "knowledge_documents"("collection_id");

-- AlterTable: knowledge_chunks gains embedding provenance + checksum
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_model" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_provider" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_dimensions" INTEGER;
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_checksum" TEXT;
CREATE INDEX "knowledge_chunks_organization_id_embedding_checksum_embeddin_idx" ON "knowledge_chunks"("organization_id", "embedding_checksum", "embedding_model");

-- AddForeignKey
ALTER TABLE "knowledge_collections" ADD CONSTRAINT "knowledge_collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
