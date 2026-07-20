-- Prisma also generated DROP INDEX statements for knowledge_chunks'
-- content_tsv / embedding HNSW indexes and an ALTER COLUMN ... DROP DEFAULT
-- on knowledge_chunks.content_tsv here — the usual drift artifacts from the
-- raw-SQL pgvector/tsvector constructs Prisma cannot model. Removed by hand,
-- same as every migration since 20260705093948_add_knowledge_graph_rag.

-- AlterTable: owner-facing sentence for held work, written at approval
-- creation from the tool's grounding vocabulary (docs/design/ASK.md §5).
-- The frontend renders this and never invents summaries.
ALTER TABLE "agent_action_approvals" ADD COLUMN "summary" TEXT;
