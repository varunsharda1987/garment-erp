-- Dyed / printed fabric lots keep their rolls & thans (2026-09-28, plans/fabric-lot-rolls-thans.md).
-- Until now a finished-fabric lot kept no piece list: the processor's than list typed at "Receive from
-- processor" stayed on the receipt (grn_item_details) and the lot never got it, so cutting took whole lots
-- blind and nobody could tell which thans were at cutting and which came back.
--
-- fabric_stock.foldLengthCm — the fold L the lot's pieces are COUNTED at (the lot itself stays ACTUAL).
-- fabric_stock_details     — one roll / than of a lot (source RECEIPT | COUNT | END).
-- fabric_issue_details     — which pieces left on which challan, for which cutting batch or job; a return
--                            stamps the row (metersReturned / returnedAt / returnChallanId), never deletes it.

-- AlterTable
ALTER TABLE "fabric_stock" ADD COLUMN     "foldLengthCm" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "fabric_stock_details" (
    "id" TEXT NOT NULL,
    "fabricStockId" TEXT NOT NULL,
    "grnItemDetailId" TEXT,
    "baleNumber" INTEGER,
    "sequenceNo" INTEGER NOT NULL,
    "meters" DECIMAL(10,3) NOT NULL,
    "metersRemaining" DECIMAL(10,3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "detailType" VARCHAR(10) NOT NULL DEFAULT 'THAN',
    "source" VARCHAR(12) NOT NULL DEFAULT 'RECEIPT',
    "baleNo" VARCHAR(30),
    "thanNo" VARCHAR(30),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_stock_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_issue_details" (
    "id" TEXT NOT NULL,
    "fabricStockDetailId" TEXT NOT NULL,
    "challanId" TEXT,
    "challanItemId" TEXT,
    "cuttingBatchId" TEXT,
    "jobWorkOrderId" TEXT,
    "metersIssued" DECIMAL(10,3) NOT NULL,
    "metersReturned" DECIMAL(10,3),
    "returnedAt" TIMESTAMP(3),
    "returnChallanId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_issue_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fabric_stock_details_fabricStockId_idx" ON "fabric_stock_details"("fabricStockId");

-- CreateIndex
CREATE INDEX "fabric_stock_details_status_idx" ON "fabric_stock_details"("status");

-- CreateIndex
CREATE INDEX "fabric_stock_details_grnItemDetailId_idx" ON "fabric_stock_details"("grnItemDetailId");

-- CreateIndex
CREATE INDEX "fabric_issue_details_fabricStockDetailId_idx" ON "fabric_issue_details"("fabricStockDetailId");

-- CreateIndex
CREATE INDEX "fabric_issue_details_challanId_idx" ON "fabric_issue_details"("challanId");

-- CreateIndex
CREATE INDEX "fabric_issue_details_cuttingBatchId_idx" ON "fabric_issue_details"("cuttingBatchId");

-- CreateIndex
CREATE INDEX "fabric_issue_details_jobWorkOrderId_idx" ON "fabric_issue_details"("jobWorkOrderId");

-- AddForeignKey
ALTER TABLE "fabric_stock_details" ADD CONSTRAINT "fabric_stock_details_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock_details" ADD CONSTRAINT "fabric_stock_details_grnItemDetailId_fkey" FOREIGN KEY ("grnItemDetailId") REFERENCES "grn_item_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_fabricStockDetailId_fkey" FOREIGN KEY ("fabricStockDetailId") REFERENCES "fabric_stock_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_challanItemId_fkey" FOREIGN KEY ("challanItemId") REFERENCES "challan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_returnChallanId_fkey" FOREIGN KEY ("returnChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_issue_details" ADD CONSTRAINT "fabric_issue_details_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every lot booked from a receipt line takes that line's fold length (7 live lots: 99 on 7cb24481, 100 on the rest)
UPDATE "fabric_stock" fs SET "foldLengthCm" = gi."foldLengthCm"
  FROM "grn_items" gi WHERE gi."id" = fs."grnItemId" AND gi."foldLengthCm" IS NOT NULL;
