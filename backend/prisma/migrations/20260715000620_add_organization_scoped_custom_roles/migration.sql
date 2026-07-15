-- Note: Prisma's migrate-diff engine also proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index.

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "organization_id" UUID;

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
