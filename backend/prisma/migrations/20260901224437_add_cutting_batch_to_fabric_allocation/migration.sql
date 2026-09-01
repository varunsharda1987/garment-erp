-- AlterTable
ALTER TABLE "fabric_stock_allocation" ADD COLUMN     "cuttingBatchId" TEXT;

-- CreateIndex
CREATE INDEX "fabric_stock_allocation_cuttingBatchId_idx" ON "fabric_stock_allocation"("cuttingBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_stock_allocation_cuttingBatchId_stockId_key" ON "fabric_stock_allocation"("cuttingBatchId", "stockId");

-- AddForeignKey
ALTER TABLE "fabric_stock_allocation" ADD CONSTRAINT "fabric_stock_allocation_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

