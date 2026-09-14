-- CreateTable
CREATE TABLE "search_misses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT,
    "endpoint" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "filters" JSONB,
    "page_route" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_misses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_misses_last_at_idx" ON "search_misses"("last_at");

-- CreateIndex
CREATE INDEX "search_misses_user_id_idx" ON "search_misses"("user_id");

-- CreateIndex
CREATE INDEX "search_misses_endpoint_idx" ON "search_misses"("endpoint");
