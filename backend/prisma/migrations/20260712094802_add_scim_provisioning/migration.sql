-- CreateEnum
CREATE TYPE "ScimTokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ScimOperationType" AS ENUM ('CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER', 'GROUP_SYNC');

-- CreateEnum
CREATE TYPE "ScimProvisionJobStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "scim_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "identity_provider_id" UUID,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "ScimTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scim_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scim_provision_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scim_token_id" UUID NOT NULL,
    "operation" "ScimOperationType" NOT NULL,
    "external_id" TEXT,
    "target_user_id" UUID,
    "target_membership_id" UUID,
    "status" "ScimProvisionJobStatus" NOT NULL,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scim_provision_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scim_tokens_token_hash_key" ON "scim_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "scim_tokens_organization_id_idx" ON "scim_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "scim_tokens_organization_id_status_idx" ON "scim_tokens"("organization_id", "status");

-- CreateIndex
CREATE INDEX "scim_provision_jobs_organization_id_idx" ON "scim_provision_jobs"("organization_id");

-- CreateIndex
CREATE INDEX "scim_provision_jobs_scim_token_id_idx" ON "scim_provision_jobs"("scim_token_id");

-- AddForeignKey
ALTER TABLE "scim_tokens" ADD CONSTRAINT "scim_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scim_tokens" ADD CONSTRAINT "scim_tokens_identity_provider_id_fkey" FOREIGN KEY ("identity_provider_id") REFERENCES "identity_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scim_provision_jobs" ADD CONSTRAINT "scim_provision_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scim_provision_jobs" ADD CONSTRAINT "scim_provision_jobs_scim_token_id_fkey" FOREIGN KEY ("scim_token_id") REFERENCES "scim_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
