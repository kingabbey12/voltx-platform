-- CreateEnum
CREATE TYPE "AgentRunStepType" AS ENUM ('PLAN', 'REASONING', 'TOOL_CALL', 'TOOL_RESULT', 'TOOL_ERROR', 'FINAL_ANSWER');

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "current_step" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "iteration_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tool_call_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "agent_run_steps" (
    "id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "type" "AgentRunStepType" NOT NULL,
    "summary" TEXT NOT NULL,
    "tool_name" TEXT,
    "input" JSONB,
    "output" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_run_steps_agent_run_id_idx" ON "agent_run_steps"("agent_run_id");

-- CreateIndex
CREATE INDEX "agent_run_steps_step_number_idx" ON "agent_run_steps"("step_number");

-- CreateIndex
CREATE INDEX "agent_run_steps_type_idx" ON "agent_run_steps"("type");

-- AddForeignKey
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
