-- CreateEnum
CREATE TYPE "IdentityProviderProtocol" AS ENUM ('SAML', 'OIDC');

-- CreateEnum
CREATE TYPE "IdentityProviderPreset" AS ENUM ('GENERIC', 'ENTRA_ID', 'OKTA', 'GOOGLE_WORKSPACE', 'ONELOGIN', 'PING_IDENTITY');

-- CreateEnum
CREATE TYPE "IdentityProviderStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "provisioned_by_identity_provider_id" UUID;

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" "IdentityProviderProtocol" NOT NULL,
    "preset" "IdentityProviderPreset" NOT NULL DEFAULT 'GENERIC',
    "status" "IdentityProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "jit_provisioning_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_role_key" TEXT NOT NULL DEFAULT 'member',
    "role_mapping_rules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saml_configurations" (
    "id" UUID NOT NULL,
    "identity_provider_id" UUID NOT NULL,
    "idp_entity_id" TEXT NOT NULL,
    "idp_sso_url" TEXT NOT NULL,
    "idp_slo_url" TEXT,
    "idp_certificate" TEXT NOT NULL,
    "idp_certificate_expires_at" TIMESTAMP(3),
    "sp_entity_id" TEXT NOT NULL,
    "signature_algorithm" TEXT NOT NULL DEFAULT 'sha256',
    "want_assertions_signed" BOOLEAN NOT NULL DEFAULT true,
    "metadata_xml" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saml_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oidc_configurations" (
    "id" UUID NOT NULL,
    "identity_provider_id" UUID NOT NULL,
    "issuer" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "authorization_endpoint" TEXT,
    "token_endpoint" TEXT,
    "userinfo_endpoint" TEXT,
    "jwks_uri" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY['openid', 'email', 'profile']::TEXT[],
    "claims_mapping" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oidc_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_providers_organization_id_idx" ON "identity_providers"("organization_id");

-- CreateIndex
CREATE INDEX "identity_providers_organization_id_status_idx" ON "identity_providers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "saml_configurations_identity_provider_id_key" ON "saml_configurations"("identity_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "oidc_configurations_identity_provider_id_key" ON "oidc_configurations"("identity_provider_id");

-- CreateIndex
CREATE INDEX "memberships_provisioned_by_identity_provider_id_idx" ON "memberships"("provisioned_by_identity_provider_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_provisioned_by_identity_provider_id_fkey" FOREIGN KEY ("provisioned_by_identity_provider_id") REFERENCES "identity_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saml_configurations" ADD CONSTRAINT "saml_configurations_identity_provider_id_fkey" FOREIGN KEY ("identity_provider_id") REFERENCES "identity_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oidc_configurations" ADD CONSTRAINT "oidc_configurations_identity_provider_id_fkey" FOREIGN KEY ("identity_provider_id") REFERENCES "identity_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
