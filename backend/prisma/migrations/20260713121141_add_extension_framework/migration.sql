-- CreateEnum
CREATE TYPE "ExtensionWidgetPlacement" AS ENUM ('DASHBOARD', 'CRM_SIDEBAR');

-- CreateTable
CREATE TABLE "extension_custom_pages" (
    "id" UUID NOT NULL,
    "marketplace_app_version_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_custom_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_custom_widgets" (
    "id" UUID NOT NULL,
    "marketplace_app_version_id" UUID NOT NULL,
    "placement" "ExtensionWidgetPlacement" NOT NULL,
    "manifest" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_custom_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_custom_nav_entries" (
    "id" UUID NOT NULL,
    "marketplace_app_version_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "target_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_custom_nav_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_ai_tools" (
    "id" UUID NOT NULL,
    "marketplace_app_version_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters_schema" JSONB NOT NULL,
    "response_schema" JSONB NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "encrypted_signing_secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_ai_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extension_custom_pages_marketplace_app_version_id_idx" ON "extension_custom_pages"("marketplace_app_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_custom_pages_marketplace_app_version_id_path_key" ON "extension_custom_pages"("marketplace_app_version_id", "path");

-- CreateIndex
CREATE INDEX "extension_custom_widgets_marketplace_app_version_id_idx" ON "extension_custom_widgets"("marketplace_app_version_id");

-- CreateIndex
CREATE INDEX "extension_custom_widgets_placement_idx" ON "extension_custom_widgets"("placement");

-- CreateIndex
CREATE INDEX "extension_custom_nav_entries_marketplace_app_version_id_idx" ON "extension_custom_nav_entries"("marketplace_app_version_id");

-- CreateIndex
CREATE INDEX "extension_ai_tools_marketplace_app_version_id_idx" ON "extension_ai_tools"("marketplace_app_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_ai_tools_marketplace_app_version_id_name_key" ON "extension_ai_tools"("marketplace_app_version_id", "name");

-- AddForeignKey
ALTER TABLE "extension_custom_pages" ADD CONSTRAINT "extension_custom_pages_marketplace_app_version_id_fkey" FOREIGN KEY ("marketplace_app_version_id") REFERENCES "marketplace_app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_custom_widgets" ADD CONSTRAINT "extension_custom_widgets_marketplace_app_version_id_fkey" FOREIGN KEY ("marketplace_app_version_id") REFERENCES "marketplace_app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_custom_nav_entries" ADD CONSTRAINT "extension_custom_nav_entries_marketplace_app_version_id_fkey" FOREIGN KEY ("marketplace_app_version_id") REFERENCES "marketplace_app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_ai_tools" ADD CONSTRAINT "extension_ai_tools_marketplace_app_version_id_fkey" FOREIGN KEY ("marketplace_app_version_id") REFERENCES "marketplace_app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
