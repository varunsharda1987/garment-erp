-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "grnItemId" VARCHAR(50);

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "actualQuantity" DECIMAL(10,3);

-- CreateIndex
CREATE INDEX "greige_stock_grnItemId_idx" ON "greige_stock"("grnItemId");

-- AddForeignKey
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
