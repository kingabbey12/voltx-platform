-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "SubscriptionChangeType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'CANCEL', 'RESUME', 'TRIAL_START', 'TRIAL_END', 'SEAT_CHANGE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "FeatureUnit" AS ENUM ('COUNT', 'TOKENS', 'BYTES', 'MINUTES');

-- CreateEnum
CREATE TYPE "CouponDuration" AS ENUM ('ONCE', 'REPEATING', 'FOREVER');

-- CreateEnum
CREATE TYPE "TaxExemptStatus" AS ENUM ('NONE', 'EXEMPT', 'REVERSE');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('OPEN', 'COMPLETE', 'EXPIRED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripe_product_id" TEXT,
    "stripe_price_id_monthly" TEXT,
    "stripe_price_id_yearly" TEXT,
    "price_monthly_usd" DECIMAL(12,2),
    "price_yearly_usd" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_features" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "FeatureUnit" NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_feature_limits" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "limit" BIGINT,
    "soft_limit_percent" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_feature_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "email" TEXT,
    "default_payment_method_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "stripe_subscription_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscription_items" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "feature_id" UUID,
    "stripe_subscription_item_id" TEXT,
    "stripe_price_id" TEXT,
    "quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscription_changes" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "from_plan_id" UUID,
    "to_plan_id" UUID,
    "change_type" "SubscriptionChangeType" NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "initiated_by" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_subscription_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_seat_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "billing_seat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_usage_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_quantity" BIGINT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "stripe_invoice_id" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount_due" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_remaining" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "hosted_invoice_url" TEXT,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "feature_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID,
    "payment_method_id" UUID,
    "stripe_payment_intent_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payment_methods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "stripe_payment_method_id" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL DEFAULT 'CARD',
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_coupons" (
    "id" UUID NOT NULL,
    "stripe_coupon_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "percent_off" DECIMAL(5,2),
    "amount_off_usd" DECIMAL(12,2),
    "duration" "CouponDuration" NOT NULL DEFAULT 'ONCE',
    "duration_in_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_promotions" (
    "id" UUID NOT NULL,
    "stripe_promotion_code_id" TEXT NOT NULL,
    "coupon_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "max_redemptions" INTEGER,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_discounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID,
    "coupon_id" UUID NOT NULL,
    "promotion_id" UUID,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "billing_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_tax_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "tax_id" TEXT,
    "tax_exempt" "TaxExemptStatus" NOT NULL DEFAULT 'NONE',
    "stripe_tax_id_id" TEXT,
    "country" TEXT,
    "address" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organization_id" UUID,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_portal_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "billing_portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_checkout_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "plan_id" UUID,
    "stripe_session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_key_key" ON "billing_plans"("key");

-- CreateIndex
CREATE INDEX "billing_plans_is_active_idx" ON "billing_plans"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "billing_features_key_key" ON "billing_features"("key");

-- CreateIndex
CREATE INDEX "billing_features_category_idx" ON "billing_features"("category");

-- CreateIndex
CREATE INDEX "billing_feature_limits_feature_id_idx" ON "billing_feature_limits"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_feature_limits_plan_id_feature_id_key" ON "billing_feature_limits"("plan_id", "feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_organization_id_key" ON "billing_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripe_customer_id_key" ON "billing_accounts"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_stripe_subscription_id_key" ON "billing_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_organization_id_idx" ON "billing_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_billing_account_id_idx" ON "billing_subscriptions"("billing_account_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_plan_id_idx" ON "billing_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_items_stripe_subscription_item_id_key" ON "billing_subscription_items"("stripe_subscription_item_id");

-- CreateIndex
CREATE INDEX "billing_subscription_items_subscription_id_idx" ON "billing_subscription_items"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_subscription_changes_subscription_id_idx" ON "billing_subscription_changes"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_subscription_changes_change_type_idx" ON "billing_subscription_changes"("change_type");

-- CreateIndex
CREATE INDEX "billing_seat_assignments_organization_id_idx" ON "billing_seat_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "billing_seat_assignments_subscription_id_idx" ON "billing_seat_assignments"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_seat_assignments_membership_id_idx" ON "billing_seat_assignments"("membership_id");

-- CreateIndex
CREATE INDEX "billing_usage_records_organization_id_feature_key_period_st_idx" ON "billing_usage_records"("organization_id", "feature_key", "period_start");

-- CreateIndex
CREATE INDEX "billing_usage_records_recorded_at_idx" ON "billing_usage_records"("recorded_at");

-- CreateIndex
CREATE INDEX "billing_usage_snapshots_organization_id_idx" ON "billing_usage_snapshots"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_snapshots_organization_id_feature_key_period__key" ON "billing_usage_snapshots"("organization_id", "feature_key", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_stripe_invoice_id_key" ON "billing_invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "billing_invoices_organization_id_idx" ON "billing_invoices"("organization_id");

-- CreateIndex
CREATE INDEX "billing_invoices_billing_account_id_idx" ON "billing_invoices"("billing_account_id");

-- CreateIndex
CREATE INDEX "billing_invoices_status_idx" ON "billing_invoices"("status");

-- CreateIndex
CREATE INDEX "billing_invoice_items_invoice_id_idx" ON "billing_invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_stripe_payment_intent_id_key" ON "billing_payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "billing_payments_organization_id_idx" ON "billing_payments"("organization_id");

-- CreateIndex
CREATE INDEX "billing_payments_invoice_id_idx" ON "billing_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "billing_payments_status_idx" ON "billing_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payment_methods_stripe_payment_method_id_key" ON "billing_payment_methods"("stripe_payment_method_id");

-- CreateIndex
CREATE INDEX "billing_payment_methods_organization_id_idx" ON "billing_payment_methods"("organization_id");

-- CreateIndex
CREATE INDEX "billing_payment_methods_billing_account_id_idx" ON "billing_payment_methods"("billing_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_coupons_stripe_coupon_id_key" ON "billing_coupons"("stripe_coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_coupons_key_key" ON "billing_coupons"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_promotions_stripe_promotion_code_id_key" ON "billing_promotions"("stripe_promotion_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_promotions_code_key" ON "billing_promotions"("code");

-- CreateIndex
CREATE INDEX "billing_discounts_organization_id_idx" ON "billing_discounts"("organization_id");

-- CreateIndex
CREATE INDEX "billing_discounts_subscription_id_idx" ON "billing_discounts"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_tax_profiles_organization_id_key" ON "billing_tax_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_tax_profiles_billing_account_id_key" ON "billing_tax_profiles"("billing_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_stripe_event_id_key" ON "billing_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "billing_events_organization_id_idx" ON "billing_events"("organization_id");

-- CreateIndex
CREATE INDEX "billing_events_type_idx" ON "billing_events"("type");

-- CreateIndex
CREATE INDEX "billing_events_processed_at_idx" ON "billing_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_portal_sessions_stripe_session_id_key" ON "billing_portal_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "billing_portal_sessions_organization_id_idx" ON "billing_portal_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_sessions_stripe_session_id_key" ON "billing_checkout_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "billing_checkout_sessions_organization_id_idx" ON "billing_checkout_sessions"("organization_id");

-- AddForeignKey
ALTER TABLE "billing_feature_limits" ADD CONSTRAINT "billing_feature_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_feature_limits" ADD CONSTRAINT "billing_feature_limits_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "billing_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "billing_features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription_changes" ADD CONSTRAINT "billing_subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_seat_assignments" ADD CONSTRAINT "billing_seat_assignments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_seat_assignments" ADD CONSTRAINT "billing_seat_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_seat_assignments" ADD CONSTRAINT "billing_seat_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_snapshots" ADD CONSTRAINT "billing_usage_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "billing_features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "billing_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_promotions" ADD CONSTRAINT "billing_promotions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "billing_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_discounts" ADD CONSTRAINT "billing_discounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_discounts" ADD CONSTRAINT "billing_discounts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_discounts" ADD CONSTRAINT "billing_discounts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "billing_coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_discounts" ADD CONSTRAINT "billing_discounts_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "billing_promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_tax_profiles" ADD CONSTRAINT "billing_tax_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_tax_profiles" ADD CONSTRAINT "billing_tax_profiles_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
