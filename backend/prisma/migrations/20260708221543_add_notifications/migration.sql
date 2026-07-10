-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('MESSAGE', 'CALL', 'MEETING', 'CRM', 'WORKFLOW', 'AI', 'SECURITY', 'BILLING');

-- Note: Prisma's migrate-diff engine proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notification_preferences" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "action_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_organization_id_user_id_read_idx" ON "notifications"("organization_id", "user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
