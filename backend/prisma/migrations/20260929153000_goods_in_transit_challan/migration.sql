-- Goods-in-transit challan (2026-09-29): a Rule 45 challan issued when the supplier despatches straight to a
-- processor, adopted by the receipt on arrival. Additive only: nullable columns + one new table.
-- AlterTable
ALTER TABLE "challans" ADD COLUMN     "poDeliveryPointId" TEXT,
ADD COLUMN     "supplierDispatchedAt" TIMESTAMP(3),
ADD COLUMN     "supplierInvoiceDate" TIMESTAMP(3),
ADD COLUMN     "supplierInvoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "arrivedQty" DECIMAL(12,3),
ADD COLUMN     "entryMode" VARCHAR(20),
ADD COLUMN     "poItemId" TEXT;

-- CreateTable
CREATE TABLE "challan_item_pieces" (
    "id" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "detailType" VARCHAR(10) NOT NULL DEFAULT 'THAN',
    "baleNumber" INTEGER,
    "baleNo" VARCHAR(30),
    "thanNo" VARCHAR(30),
    "sequenceNo" INTEGER NOT NULL,
    "meters" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challan_item_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challan_item_pieces_challanItemId_idx" ON "challan_item_pieces"("challanItemId");

-- CreateIndex
CREATE INDEX "challans_poDeliveryPointId_idx" ON "challans"("poDeliveryPointId");

-- CreateIndex
CREATE INDEX "challan_items_poItemId_idx" ON "challan_items"("poItemId");

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_poDeliveryPointId_fkey" FOREIGN KEY ("poDeliveryPointId") REFERENCES "po_delivery_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_item_pieces" ADD CONSTRAINT "challan_item_pieces_challanItemId_fkey" FOREIGN KEY ("challanItemId") REFERENCES "challan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

