/*
  Warnings:

  - Added the required column `conversation_id` to the `workflow_runs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "workflow_runs" ADD COLUMN     "conversation_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "workflow_runs_conversation_id_idx" ON "workflow_runs"("conversation_id");

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
