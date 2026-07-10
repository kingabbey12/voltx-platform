-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'QUARANTINED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttachmentReferenceType" AS ENUM ('AI_CONVERSATION', 'AI_MESSAGE', 'CRM_CONTACT', 'CRM_COMPANY', 'CRM_LEAD', 'CRM_OPPORTUNITY', 'CRM_ACTIVITY', 'COMMS_MESSAGE');

-- Note: Prisma's migrate-diff engine proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index.

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum_sha256" TEXT,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "scan_result" TEXT,
    "thumbnail_key" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "extracted_text" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_versions" (
    "id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_references" (
    "id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reference_type" "AttachmentReferenceType" NOT NULL,
    "reference_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_organization_id_idx" ON "attachments"("organization_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_idx" ON "attachments"("uploaded_by");

-- CreateIndex
CREATE INDEX "attachments_status_idx" ON "attachments"("status");

-- CreateIndex
CREATE INDEX "attachments_deleted_at_idx" ON "attachments"("deleted_at");

-- CreateIndex
CREATE INDEX "attachments_organization_id_created_at_idx" ON "attachments"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "attachment_versions_organization_id_idx" ON "attachment_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_versions_attachment_id_version_number_key" ON "attachment_versions"("attachment_id", "version_number");

-- CreateIndex
CREATE INDEX "attachment_references_organization_id_idx" ON "attachment_references"("organization_id");

-- CreateIndex
CREATE INDEX "attachment_references_reference_type_reference_id_idx" ON "attachment_references"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_references_attachment_id_reference_type_referenc_key" ON "attachment_references"("attachment_id", "reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_versions" ADD CONSTRAINT "attachment_versions_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_references" ADD CONSTRAINT "attachment_references_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
