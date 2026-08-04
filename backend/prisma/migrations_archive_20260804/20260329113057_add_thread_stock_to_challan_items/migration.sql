-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "threadStockId" TEXT;

-- CreateIndex
CREATE INDEX "challan_items_threadStockId_idx" ON "challan_items"("threadStockId");

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_threadStockId_fkey" FOREIGN KEY ("threadStockId") REFERENCES "thread_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
