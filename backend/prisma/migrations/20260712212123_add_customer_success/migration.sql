-- CreateEnum
CREATE TYPE "SupportSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "support_session_id" UUID;

-- CreateTable
CREATE TABLE "support_sessions" (
    "id" UUID NOT NULL,
    "platform_admin_user_id" UUID NOT NULL,
    "target_organization_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SupportSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "support_membership_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "ended_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_sessions_platform_admin_user_id_idx" ON "support_sessions"("platform_admin_user_id");

-- CreateIndex
CREATE INDEX "support_sessions_target_organization_id_idx" ON "support_sessions"("target_organization_id");

-- CreateIndex
CREATE INDEX "support_sessions_status_idx" ON "support_sessions"("status");

-- CreateIndex
CREATE INDEX "support_notes_organization_id_idx" ON "support_notes"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_support_session_id_idx" ON "audit_logs"("support_session_id");
