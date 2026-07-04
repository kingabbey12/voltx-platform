-- CreateEnum
CREATE TYPE "SalesCompanyStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SalesLeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'NURTURING', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "SalesOpportunityStage" AS ENUM ('DISCOVERY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "SalesActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');

-- CreateTable
CREATE TABLE "sales_companies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "status" "SalesCompanyStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "contact_id" UUID,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "status" "SalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "qualification_score" INTEGER,
    "qualification_summary" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "contact_id" UUID,
    "lead_id" UUID,
    "title" TEXT NOT NULL,
    "stage" "SalesOpportunityStage" NOT NULL DEFAULT 'DISCOVERY',
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expected_close_at" TIMESTAMP(3),
    "insights" TEXT,
    "next_best_action" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_activities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "contact_id" UUID,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "type" "SalesActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "meeting_summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_companies_organization_id_idx" ON "sales_companies"("organization_id");
CREATE INDEX "sales_companies_status_idx" ON "sales_companies"("status");
CREATE INDEX "sales_companies_deleted_at_idx" ON "sales_companies"("deleted_at");
CREATE INDEX "sales_companies_created_at_idx" ON "sales_companies"("created_at");

CREATE INDEX "sales_contacts_organization_id_idx" ON "sales_contacts"("organization_id");
CREATE INDEX "sales_contacts_company_id_idx" ON "sales_contacts"("company_id");
CREATE INDEX "sales_contacts_deleted_at_idx" ON "sales_contacts"("deleted_at");
CREATE INDEX "sales_contacts_created_at_idx" ON "sales_contacts"("created_at");

CREATE INDEX "sales_leads_organization_id_idx" ON "sales_leads"("organization_id");
CREATE INDEX "sales_leads_company_id_idx" ON "sales_leads"("company_id");
CREATE INDEX "sales_leads_contact_id_idx" ON "sales_leads"("contact_id");
CREATE INDEX "sales_leads_status_idx" ON "sales_leads"("status");
CREATE INDEX "sales_leads_deleted_at_idx" ON "sales_leads"("deleted_at");
CREATE INDEX "sales_leads_created_at_idx" ON "sales_leads"("created_at");

CREATE INDEX "sales_opportunities_organization_id_idx" ON "sales_opportunities"("organization_id");
CREATE INDEX "sales_opportunities_company_id_idx" ON "sales_opportunities"("company_id");
CREATE INDEX "sales_opportunities_contact_id_idx" ON "sales_opportunities"("contact_id");
CREATE INDEX "sales_opportunities_lead_id_idx" ON "sales_opportunities"("lead_id");
CREATE INDEX "sales_opportunities_stage_idx" ON "sales_opportunities"("stage");
CREATE INDEX "sales_opportunities_deleted_at_idx" ON "sales_opportunities"("deleted_at");
CREATE INDEX "sales_opportunities_created_at_idx" ON "sales_opportunities"("created_at");

CREATE INDEX "sales_activities_organization_id_idx" ON "sales_activities"("organization_id");
CREATE INDEX "sales_activities_company_id_idx" ON "sales_activities"("company_id");
CREATE INDEX "sales_activities_contact_id_idx" ON "sales_activities"("contact_id");
CREATE INDEX "sales_activities_lead_id_idx" ON "sales_activities"("lead_id");
CREATE INDEX "sales_activities_opportunity_id_idx" ON "sales_activities"("opportunity_id");
CREATE INDEX "sales_activities_type_idx" ON "sales_activities"("type");
CREATE INDEX "sales_activities_completed_idx" ON "sales_activities"("completed");
CREATE INDEX "sales_activities_deleted_at_idx" ON "sales_activities"("deleted_at");
CREATE INDEX "sales_activities_created_at_idx" ON "sales_activities"("created_at");

-- AddForeignKey
ALTER TABLE "sales_companies" ADD CONSTRAINT "sales_companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "sales_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
