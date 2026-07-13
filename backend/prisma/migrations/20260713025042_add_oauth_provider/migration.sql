-- CreateEnum
CREATE TYPE "OAuthApplicationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "oauth_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "client_secret_prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "OAuthApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_redirect_uris" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "uri" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_redirect_uris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_codes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "authorizing_user_id" UUID NOT NULL,
    "authorizing_organization_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "authorizing_user_id" UUID NOT NULL,
    "authorizing_organization_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_refresh_tokens" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "access_token_id" UUID NOT NULL,
    "authorizing_user_id" UUID NOT NULL,
    "authorizing_organization_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_applications_client_id_key" ON "oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "oauth_applications_organization_id_idx" ON "oauth_applications"("organization_id");

-- CreateIndex
CREATE INDEX "oauth_redirect_uris_application_id_idx" ON "oauth_redirect_uris"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_redirect_uris_application_id_uri_key" ON "oauth_redirect_uris"("application_id", "uri");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_key" ON "oauth_authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "oauth_authorization_codes_application_id_idx" ON "oauth_authorization_codes"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_application_id_idx" ON "oauth_access_tokens"("application_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_authorizing_user_id_idx" ON "oauth_access_tokens"("authorizing_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_tokens_access_token_id_key" ON "oauth_refresh_tokens"("access_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_tokens_token_hash_key" ON "oauth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "oauth_refresh_tokens_application_id_idx" ON "oauth_refresh_tokens"("application_id");

-- AddForeignKey
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_redirect_uris" ADD CONSTRAINT "oauth_redirect_uris_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_access_token_id_fkey" FOREIGN KEY ("access_token_id") REFERENCES "oauth_access_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
