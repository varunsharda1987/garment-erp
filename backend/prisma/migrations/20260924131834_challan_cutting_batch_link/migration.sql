-- AlterTable
ALTER TABLE "challans" ADD COLUMN     "cuttingBatchId" TEXT;

-- CreateIndex
CREATE INDEX "challans_cuttingBatchId_idx" ON "challans"("cuttingBatchId");

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
