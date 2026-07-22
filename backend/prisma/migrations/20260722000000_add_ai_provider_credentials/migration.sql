-- Per-organization encrypted AI provider credentials (BYO keys) for the AI
-- Gateway. Hand-written to avoid the knowledge_chunks pgvector/tsvector drift
-- artifacts Prisma regenerates, per the convention since
-- 20260705093948_add_knowledge_graph_rag.

-- CreateEnum
CREATE TYPE "AiProviderCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'default',
    "encrypted_api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "AiProviderCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_rotated_at" TIMESTAMP(3),
    "last_tested_at" TIMESTAMP(3),
    "last_test_status" TEXT,
    "last_test_error" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_provider_credentials_organization_id_idx" ON "ai_provider_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "ai_provider_credentials_provider_idx" ON "ai_provider_credentials"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_credentials_deleted_at_idx" ON "ai_provider_credentials"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_credentials_organization_id_provider_label_key" ON "ai_provider_credentials"("organization_id", "provider", "label");

-- AddForeignKey
ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
