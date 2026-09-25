-- Weaver on the purchase and the lot, never on the greige master (owner, 2026-09-24).
-- The weaver we buy a greige from keeps changing; it is recorded on the PO line (optional), the GRN
-- line (what actually arrived) and the stock lot, so every weaver's lots stay under ONE greige.
-- Additive only: a small weavers list (unique on a normalised name) + nullable weaverId columns.
-- Plan: we-have-recently-made-wondrous-volcano.md, Phase 1b.

-- AlterTable
ALTER TABLE "fabric_stock" ADD COLUMN     "weaverId" TEXT,
ADD COLUMN     "weaverMix" JSONB;

-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "weaverId" TEXT;

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "weaverId" TEXT,
ADD COLUMN     "weaverNotKnown" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "weaverId" TEXT;

-- CreateTable
CREATE TABLE "weavers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "city" TEXT,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weavers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weavers_nameKey_key" ON "weavers"("nameKey");

-- CreateIndex
CREATE INDEX "weavers_supplierId_idx" ON "weavers"("supplierId");

-- CreateIndex
CREATE INDEX "fabric_stock_weaverId_idx" ON "fabric_stock"("weaverId");

-- CreateIndex
CREATE INDEX "greige_stock_weaverId_idx" ON "greige_stock"("weaverId");

-- CreateIndex
CREATE INDEX "grn_items_weaverId_idx" ON "grn_items"("weaverId");

-- CreateIndex
CREATE INDEX "purchase_order_items_weaverId_idx" ON "purchase_order_items"("weaverId");

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "weavers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "weavers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weavers" ADD CONSTRAINT "weavers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "weavers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "weavers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
