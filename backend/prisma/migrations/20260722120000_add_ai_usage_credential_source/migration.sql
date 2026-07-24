-- Records whether an AI request used the PLATFORM env key or a TENANT
-- bring-your-own key, so cost/usage can be attributed per credential source.
-- Nullable and backfill-free: historical rows predate BYO credentials.
ALTER TABLE "ai_usage_logs" ADD COLUMN "credential_source" TEXT;
