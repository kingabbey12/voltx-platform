-- CreateEnum
CREATE TYPE "AgentMessageType" AS ENUM ('REQUEST', 'RESPONSE', 'STATUS', 'OBSERVATION', 'COMPLETION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentRunStepType" ADD VALUE 'DELEGATION_START';
ALTER TYPE "AgentRunStepType" ADD VALUE 'DELEGATION_RESULT';

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parent_run_id" UUID,
ADD COLUMN     "root_run_id" UUID;

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" UUID NOT NULL,
    "root_run_id" UUID NOT NULL,
    "from_agent_run_id" UUID NOT NULL,
    "to_agent_run_id" UUID,
    "type" "AgentMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_messages_root_run_id_idx" ON "agent_messages"("root_run_id");

-- CreateIndex
CREATE INDEX "agent_messages_from_agent_run_id_idx" ON "agent_messages"("from_agent_run_id");

-- CreateIndex
CREATE INDEX "agent_messages_to_agent_run_id_idx" ON "agent_messages"("to_agent_run_id");

-- CreateIndex
CREATE INDEX "agent_messages_type_idx" ON "agent_messages"("type");

-- CreateIndex
CREATE INDEX "agent_runs_parent_run_id_idx" ON "agent_runs"("parent_run_id");

-- CreateIndex
CREATE INDEX "agent_runs_root_run_id_idx" ON "agent_runs"("root_run_id");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_from_agent_run_id_fkey" FOREIGN KEY ("from_agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
