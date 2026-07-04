-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "content" TEXT NOT NULL,
    "embedding_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_accesses" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_organization_id_idx" ON "memories"("organization_id");

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");

-- CreateIndex
CREATE INDEX "memories_conversation_id_idx" ON "memories"("conversation_id");

-- CreateIndex
CREATE INDEX "memories_category_idx" ON "memories"("category");

-- CreateIndex
CREATE INDEX "memories_importance_idx" ON "memories"("importance");

-- CreateIndex
CREATE INDEX "memories_deleted_at_idx" ON "memories"("deleted_at");

-- CreateIndex
CREATE INDEX "memories_created_at_idx" ON "memories"("created_at");

-- CreateIndex
CREATE INDEX "memory_accesses_memory_id_idx" ON "memory_accesses"("memory_id");

-- CreateIndex
CREATE INDEX "memory_accesses_conversation_id_idx" ON "memory_accesses"("conversation_id");

-- CreateIndex
CREATE INDEX "memory_accesses_accessed_at_idx" ON "memory_accesses"("accessed_at");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_accesses" ADD CONSTRAINT "memory_accesses_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_accesses" ADD CONSTRAINT "memory_accesses_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
