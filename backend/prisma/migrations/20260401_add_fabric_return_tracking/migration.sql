-- AlterTable
ALTER TABLE "cutting_batch_fabrics" ADD COLUMN     "actualConsumption" DECIMAL(10,2),
ADD COLUMN     "fabricIssued" DECIMAL(10,2),
ADD COLUMN     "fabricReturned" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "cutting_batches" ADD COLUMN     "actualConsumption" DECIMAL(10,2),
ADD COLUMN     "fabricIssued" DECIMAL(10,2),
ADD COLUMN     "fabricReturned" DECIMAL(10,2),
ADD COLUMN     "returnChallanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batches_returnChallanId_key" ON "cutting_batches"("returnChallanId");

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_returnChallanId_fkey" FOREIGN KEY ("returnChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
