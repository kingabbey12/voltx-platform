-- CreateEnum
CREATE TYPE "WorkflowVariableType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowStepType" ADD VALUE 'LOOP';
ALTER TYPE "WorkflowStepType" ADD VALUE 'SWITCH';

-- Note: Prisma's diff engine repeatedly proposes dropping
-- knowledge_chunks' generated tsvector column/HNSW index and its
-- DEFAULT — a known false positive against manually-managed
-- generated/vector columns not fully expressible in the Prisma schema
-- (same false positive stripped from prior migrations in this
-- history). Intentionally omitted here; do not re-add.

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_secrets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "last_rotated_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_webhooks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_variables" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID,
    "key" TEXT NOT NULL,
    "type" "WorkflowVariableType" NOT NULL DEFAULT 'STRING',
    "default_value" JSONB NOT NULL DEFAULT 'null',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_key_key" ON "workflow_templates"("key");

-- CreateIndex
CREATE INDEX "workflow_templates_organization_id_idx" ON "workflow_templates"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_templates_category_idx" ON "workflow_templates"("category");

-- CreateIndex
CREATE INDEX "workflow_templates_is_system_idx" ON "workflow_templates"("is_system");

-- CreateIndex
CREATE INDEX "workflow_templates_deleted_at_idx" ON "workflow_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "workflow_secrets_organization_id_idx" ON "workflow_secrets"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_secrets_organization_id_key_key" ON "workflow_secrets"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_webhooks_token_key" ON "workflow_webhooks"("token");

-- CreateIndex
CREATE INDEX "workflow_webhooks_organization_id_idx" ON "workflow_webhooks"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_webhooks_workflow_id_idx" ON "workflow_webhooks"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_variables_organization_id_idx" ON "workflow_variables"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_variables_workflow_id_idx" ON "workflow_variables"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_variables_organization_id_workflow_id_key_key" ON "workflow_variables"("organization_id", "workflow_id", "key");

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_secrets" ADD CONSTRAINT "workflow_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_webhooks" ADD CONSTRAINT "workflow_webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_webhooks" ADD CONSTRAINT "workflow_webhooks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_variables" ADD CONSTRAINT "workflow_variables_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_variables" ADD CONSTRAINT "workflow_variables_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
