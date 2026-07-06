-- Enable pgvector for embedding storage/similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('CRM_CONTACT', 'CRM_COMPANY', 'CRM_OPPORTUNITY', 'CRM_ACTIVITY', 'NOTE', 'DOCUMENT', 'EMAIL', 'CALENDAR', 'TASK', 'MEETING', 'UPLOADED_FILE', 'AI_MEMORY', 'OTHER');

-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PENDING', 'INDEXING', 'INDEXED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeEntityType" AS ENUM ('PERSON', 'COMPANY', 'DEAL', 'PROJECT', 'TASK', 'MEETING', 'DOCUMENT', 'EMAIL', 'FILE', 'NOTE', 'AGENT', 'WORKFLOW', 'MEMORY');

-- CreateEnum
CREATE TYPE "KnowledgeRelationshipType" AS ENUM ('OWNS', 'WORKS_AT', 'ASSOCIATED_WITH', 'PARTICIPATED_IN', 'ASSIGNED_TO', 'MENTIONS', 'ATTACHED_TO', 'RELATED_TO', 'CREATED_BY');

-- AlterEnum
ALTER TYPE "AiRequestType" ADD VALUE 'KNOWLEDGE_EMBEDDING';

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "raw_text" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "indexed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding" vector(1536),
    "content_tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "KnowledgeEntityType" NOT NULL,
    "external_id" TEXT,
    "label" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_relationships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_entity_id" UUID NOT NULL,
    "to_entity_id" UUID NOT NULL,
    "type" "KnowledgeRelationshipType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_search_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL,
    "cited_result_count" INTEGER NOT NULL,
    "top_confidence" DOUBLE PRECISION,
    "average_confidence" DOUBLE PRECISION,
    "latency_ms" INTEGER NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_sources_organization_id_idx" ON "knowledge_sources"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_type_idx" ON "knowledge_sources"("type");

-- CreateIndex
CREATE INDEX "knowledge_sources_status_idx" ON "knowledge_sources"("status");

-- CreateIndex
CREATE INDEX "knowledge_sources_deleted_at_idx" ON "knowledge_sources"("deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_organization_id_idx" ON "knowledge_documents"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_source_id_idx" ON "knowledge_documents"("source_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_external_id_idx" ON "knowledge_documents"("external_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_deleted_at_idx" ON "knowledge_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_chunks_organization_id_idx" ON "knowledge_chunks"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_deleted_at_idx" ON "knowledge_chunks"("deleted_at");

-- CreateIndex: HNSW cosine-distance index for semantic similarity search
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex: GIN index over the generated tsvector for keyword search
CREATE INDEX "knowledge_chunks_content_tsv_idx" ON "knowledge_chunks" USING gin ("content_tsv");

-- CreateIndex
CREATE INDEX "knowledge_entities_organization_id_idx" ON "knowledge_entities"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_entities_type_idx" ON "knowledge_entities"("type");

-- CreateIndex
CREATE INDEX "knowledge_entities_external_id_idx" ON "knowledge_entities"("external_id");

-- CreateIndex
CREATE INDEX "knowledge_entities_deleted_at_idx" ON "knowledge_entities"("deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_relationships_organization_id_idx" ON "knowledge_relationships"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_relationships_from_entity_id_idx" ON "knowledge_relationships"("from_entity_id");

-- CreateIndex
CREATE INDEX "knowledge_relationships_to_entity_id_idx" ON "knowledge_relationships"("to_entity_id");

-- CreateIndex
CREATE INDEX "knowledge_relationships_type_idx" ON "knowledge_relationships"("type");

-- CreateIndex
CREATE INDEX "knowledge_search_logs_organization_id_idx" ON "knowledge_search_logs"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_search_logs_created_at_idx" ON "knowledge_search_logs"("created_at");

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entities" ADD CONSTRAINT "knowledge_entities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relationships" ADD CONSTRAINT "knowledge_relationships_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "knowledge_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relationships" ADD CONSTRAINT "knowledge_relationships_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "knowledge_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
