-- CreateEnum
CREATE TYPE "AuditExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "AuditExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "RetentionResourceType" AS ENUM ('AUDIT_LOG', 'CONVERSATION', 'NOTIFICATION', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('DELETE', 'ANONYMIZE');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previous_hash" TEXT;

-- CreateTable
CREATE TABLE "audit_exports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "format" "AuditExportFormat" NOT NULL DEFAULT 'JSON',
    "status" "AuditExportStatus" NOT NULL DEFAULT 'PENDING',
    "storage_key" TEXT,
    "row_count" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "audit_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "target_user_id" UUID,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "released_by" UUID,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "resource_type" "RetentionResourceType" NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "action" "RetentionAction" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_exports_organization_id_idx" ON "audit_exports"("organization_id");

-- CreateIndex
CREATE INDEX "audit_exports_organization_id_status_idx" ON "audit_exports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "legal_holds_organization_id_idx" ON "legal_holds"("organization_id");

-- CreateIndex
CREATE INDEX "legal_holds_organization_id_status_idx" ON "legal_holds"("organization_id", "status");

-- CreateIndex
CREATE INDEX "legal_holds_target_user_id_idx" ON "legal_holds"("target_user_id");

-- CreateIndex
CREATE INDEX "retention_policies_organization_id_idx" ON "retention_policies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_organization_id_resource_type_key" ON "retention_policies"("organization_id", "resource_type");

-- CreateIndex
CREATE INDEX "consent_records_organization_id_idx" ON "consent_records"("organization_id");

-- CreateIndex
CREATE INDEX "consent_records_user_id_idx" ON "consent_records"("user_id");

-- CreateIndex
CREATE INDEX "consent_records_user_id_consent_type_idx" ON "consent_records"("user_id", "consent_type");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_exports" ADD CONSTRAINT "audit_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
