-- Adds the embeddings-pending marker for degraded (no-AI-provider)
-- knowledge ingestion: documents indexed without embeddings carry a
-- timestamp here until the backfill cron re-embeds them.
--
-- Hand-written (not `prisma migrate dev` output): Prisma's diff engine
-- cannot model knowledge_chunks' generated content_tsv column and tries
-- to emit destructive "corrections" (dropping the tsvector/HNSW indexes)
-- alongside any schema change touching this area. Only the two additive
-- statements below are intended.

-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN "embeddings_pending_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "knowledge_documents_embeddings_pending_at_idx" ON "knowledge_documents"("embeddings_pending_at");
