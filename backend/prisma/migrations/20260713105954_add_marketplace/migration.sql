-- CreateEnum
CREATE TYPE "MarketplaceAppStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MarketplaceAppVersionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketplaceInstallStatus" AS ENUM ('ACTIVE', 'UNINSTALLED');

-- CreateEnum
CREATE TYPE "DeveloperConnectOnboardingStatus" AS ENUM ('PENDING', 'ONBOARDING', 'COMPLETE');

-- CreateTable
CREATE TABLE "marketplace_apps" (
    "id" UUID NOT NULL,
    "developer_organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon_url" TEXT,
    "status" "MarketplaceAppStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_app_versions" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "changelog" TEXT,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketplaceAppVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_installs" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "installing_organization_id" UUID NOT NULL,
    "installed_version_id" UUID NOT NULL,
    "status" "MarketplaceInstallStatus" NOT NULL DEFAULT 'ACTIVE',
    "installed_by_user_id" UUID NOT NULL,
    "uninstalled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_reviews" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "install_id" UUID NOT NULL,
    "installing_organization_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_connect_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stripe_connected_account_id" TEXT NOT NULL,
    "onboarding_status" "DeveloperConnectOnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_connect_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_revenue_shares" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "install_id" UUID NOT NULL,
    "purchase_amount_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL,
    "developer_payout_cents" INTEGER NOT NULL,
    "stripe_checkout_session_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_revenue_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_apps_developer_organization_id_idx" ON "marketplace_apps"("developer_organization_id");

-- CreateIndex
CREATE INDEX "marketplace_apps_status_idx" ON "marketplace_apps"("status");

-- CreateIndex
CREATE INDEX "marketplace_app_versions_app_id_idx" ON "marketplace_app_versions"("app_id");

-- CreateIndex
CREATE INDEX "marketplace_app_versions_status_idx" ON "marketplace_app_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_app_versions_app_id_version_key" ON "marketplace_app_versions"("app_id", "version");

-- CreateIndex
CREATE INDEX "marketplace_installs_installing_organization_id_idx" ON "marketplace_installs"("installing_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_installs_app_id_installing_organization_id_key" ON "marketplace_installs"("app_id", "installing_organization_id");

-- CreateIndex
CREATE INDEX "marketplace_reviews_app_id_idx" ON "marketplace_reviews"("app_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reviews_app_id_installing_organization_id_key" ON "marketplace_reviews"("app_id", "installing_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "developer_connect_accounts_organization_id_key" ON "developer_connect_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "developer_connect_accounts_stripe_connected_account_id_key" ON "developer_connect_accounts"("stripe_connected_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_revenue_shares_stripe_checkout_session_id_key" ON "marketplace_revenue_shares"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "marketplace_revenue_shares_app_id_idx" ON "marketplace_revenue_shares"("app_id");

-- AddForeignKey
ALTER TABLE "marketplace_apps" ADD CONSTRAINT "marketplace_apps_developer_organization_id_fkey" FOREIGN KEY ("developer_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_app_versions" ADD CONSTRAINT "marketplace_app_versions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "marketplace_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "marketplace_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_installing_organization_id_fkey" FOREIGN KEY ("installing_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_installs" ADD CONSTRAINT "marketplace_installs_installed_version_id_fkey" FOREIGN KEY ("installed_version_id") REFERENCES "marketplace_app_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "marketplace_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_install_id_fkey" FOREIGN KEY ("install_id") REFERENCES "marketplace_installs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_connect_accounts" ADD CONSTRAINT "developer_connect_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_revenue_shares" ADD CONSTRAINT "marketplace_revenue_shares_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "marketplace_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_revenue_shares" ADD CONSTRAINT "marketplace_revenue_shares_install_id_fkey" FOREIGN KEY ("install_id") REFERENCES "marketplace_installs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
