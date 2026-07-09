-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('JUST_ME', 'EMPLOYEES_2_10', 'EMPLOYEES_11_50', 'EMPLOYEES_51_200', 'EMPLOYEES_201_500', 'EMPLOYEES_501_1000', 'EMPLOYEES_1000_PLUS');

-- Note: Prisma's migrate-diff engine proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "city" TEXT,
ADD COLUMN     "company_size" "CompanySize",
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "primary_goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "state" TEXT,
ADD COLUMN     "website" TEXT;
