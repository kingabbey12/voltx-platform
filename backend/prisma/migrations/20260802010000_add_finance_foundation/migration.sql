CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'VOID');

CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "type" "FinancialTransactionType" NOT NULL,
    "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "category" TEXT NOT NULL,
    "counterparty_name" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "external_reference" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_budgets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "financial_budgets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_transactions_organization_id_occurred_at_idx"
ON "financial_transactions"("organization_id", "occurred_at");
CREATE INDEX "financial_transactions_organization_id_type_status_occurred_at_idx"
ON "financial_transactions"("organization_id", "type", "status", "occurred_at");
CREATE INDEX "financial_transactions_cost_center_id_idx"
ON "financial_transactions"("cost_center_id");
CREATE INDEX "financial_budgets_organization_id_period_start_period_end_idx"
ON "financial_budgets"("organization_id", "period_start", "period_end");
CREATE INDEX "financial_budgets_cost_center_id_idx" ON "financial_budgets"("cost_center_id");

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cost_center_id_fkey"
FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_budgets" ADD CONSTRAINT "financial_budgets_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_budgets" ADD CONSTRAINT "financial_budgets_cost_center_id_fkey"
FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;