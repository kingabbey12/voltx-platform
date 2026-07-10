-- DropForeignKey
ALTER TABLE "comms_attachments" DROP CONSTRAINT "comms_attachments_message_id_fkey";

-- Note: Prisma's migrate-diff engine also proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index.

-- DropTable
DROP TABLE "comms_attachments";

-- CreateTable
CREATE TABLE "comms_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comms_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comms_notes_organization_id_idx" ON "comms_notes"("organization_id");

-- CreateIndex
CREATE INDEX "comms_notes_conversation_id_idx" ON "comms_notes"("conversation_id");

-- AddForeignKey
ALTER TABLE "comms_notes" ADD CONSTRAINT "comms_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
