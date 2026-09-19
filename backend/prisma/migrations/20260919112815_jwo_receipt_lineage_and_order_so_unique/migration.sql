-- AlterTable
ALTER TABLE "challans" ADD COLUMN     "grnId" TEXT;

-- AlterTable
ALTER TABLE "fabric_stock" ADD COLUMN     "grnItemId" TEXT;

-- AlterTable
ALTER TABLE "lace_stock" ADD COLUMN     "grnItemId" TEXT;

-- CreateIndex
CREATE INDEX "challans_grnId_idx" ON "challans"("grnId");

-- CreateIndex
CREATE INDEX "fabric_stock_grnItemId_idx" ON "fabric_stock"("grnItemId");

-- CreateIndex
CREATE INDEX "lace_stock_grnItemId_idx" ON "lace_stock"("grnItemId");

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "goods_receiving_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- T2-C (hand-added; a partial unique index is not expressible in the Prisma schema).
-- One live production order per sale order: the exact predicate the integrity sweep's D11 uses
-- (scripts/check-order-system-integrity.ts). The findFirst guard in saleOrder.service.ts cannot
-- close the split-second race between two "Start production" clicks; this index does, and the
-- service turns the P2002 into the same 409.
CREATE UNIQUE INDEX "orders_saleOrderId_active_key" ON "orders" ("saleOrderId")
  WHERE "saleOrderId" IS NOT NULL AND "status" <> 'CANCELLED' AND "isActive" = true;
