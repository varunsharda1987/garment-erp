-- CreateTable
CREATE TABLE "ai_knowledge_guides" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT[],
    "content" TEXT NOT NULL,
    "sources_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_knowledge_guides_slug_key" ON "ai_knowledge_guides"("slug");

-- CreateIndex
CREATE INDEX "ai_knowledge_guides_is_active_idx" ON "ai_knowledge_guides"("is_active");
