-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('PROPOSED', 'STANDING', 'FULFILLED', 'RELEASED', 'BROKEN');

-- CreateEnum
CREATE TYPE "PromisePartyRole" AS ENUM ('OBLIGOR', 'OBLIGEE');

-- CreateEnum
CREATE TYPE "PromiseEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'AI_RECOMMENDATION', 'NOTE_ADDED');

-- AlterEnum
ALTER TYPE "AttachmentReferenceType" ADD VALUE 'PROMISE';

-- CreateTable
CREATE TABLE "promises" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PromiseStatus" NOT NULL DEFAULT 'PROPOSED',
    "owner_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "promises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promise_parties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "promise_id" UUID NOT NULL,
    "role" "PromisePartyRole" NOT NULL,
    "contact_id" UUID,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promise_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promise_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "promise_id" UUID NOT NULL,
    "type" "PromiseEventType" NOT NULL,
    "actor_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promise_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promises_organization_id_idx" ON "promises"("organization_id");

-- CreateIndex
CREATE INDEX "promises_status_idx" ON "promises"("status");

-- CreateIndex
CREATE INDEX "promises_owner_id_idx" ON "promises"("owner_id");

-- CreateIndex
CREATE INDEX "promises_due_at_idx" ON "promises"("due_at");

-- CreateIndex
CREATE INDEX "promises_deleted_at_idx" ON "promises"("deleted_at");

-- CreateIndex
CREATE INDEX "promise_parties_organization_id_idx" ON "promise_parties"("organization_id");

-- CreateIndex
CREATE INDEX "promise_parties_promise_id_idx" ON "promise_parties"("promise_id");

-- CreateIndex
CREATE INDEX "promise_parties_contact_id_idx" ON "promise_parties"("contact_id");

-- CreateIndex
CREATE INDEX "promise_parties_user_id_idx" ON "promise_parties"("user_id");

-- CreateIndex
CREATE INDEX "promise_events_organization_id_idx" ON "promise_events"("organization_id");

-- CreateIndex
CREATE INDEX "promise_events_promise_id_idx" ON "promise_events"("promise_id");

-- CreateIndex
CREATE INDEX "promise_events_type_idx" ON "promise_events"("type");

-- CreateIndex
CREATE INDEX "promise_events_occurred_at_idx" ON "promise_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "promises" ADD CONSTRAINT "promises_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promises" ADD CONSTRAINT "promises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promise_parties" ADD CONSTRAINT "promise_parties_promise_id_fkey" FOREIGN KEY ("promise_id") REFERENCES "promises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promise_parties" ADD CONSTRAINT "promise_parties_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promise_parties" ADD CONSTRAINT "promise_parties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promise_events" ADD CONSTRAINT "promise_events_promise_id_fkey" FOREIGN KEY ("promise_id") REFERENCES "promises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promise_events" ADD CONSTRAINT "promise_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
