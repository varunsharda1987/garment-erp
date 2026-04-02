-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "baleCount" INTEGER,
ADD COLUMN     "entryMode" VARCHAR(20),
ADD COLUMN     "foldLengthCm" DECIMAL(5,2),
ADD COLUMN     "isOverReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overReceiptQty" DECIMAL(10,3),
ADD COLUMN     "receivedWidthInches" DECIMAL(5,2),
ADD COLUMN     "rollCount" INTEGER,
ADD COLUMN     "thanCount" INTEGER,
ADD COLUMN     "totalMeters" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "grn_item_details" (
    "id" TEXT NOT NULL,
    "grnItemId" TEXT NOT NULL,
    "detailType" VARCHAR(10) NOT NULL,
    "baleNumber" INTEGER,
    "sequenceNo" INTEGER NOT NULL,
    "meters" DECIMAL(10,3) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "grn_item_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grn_item_details_grnItemId_idx" ON "grn_item_details"("grnItemId");

-- AddForeignKey
ALTER TABLE "grn_item_details" ADD CONSTRAINT "grn_item_details_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES "grn_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
