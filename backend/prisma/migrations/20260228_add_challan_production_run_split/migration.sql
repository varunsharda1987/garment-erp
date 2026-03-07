-- Safety: Move any existing rows using removed enum values to PROCESSING
UPDATE "purchase_orders" SET "poCategory" = 'PROCESSING' WHERE "poCategory" IN ('PRINTING_SERVICE', 'DYEING_SERVICE');

-- CreateEnum
CREATE TYPE "ChallanType" AS ENUM ('OUTWARD', 'INWARD', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ChallanStatus" AS ENUM ('DRAFT', 'ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SPLIT';

-- AlterEnum: Remove PRINTING_SERVICE and DYEING_SERVICE from POCategory
BEGIN;
CREATE TYPE "POCategory_new" AS ENUM ('FABRIC', 'GREIGE', 'PROCESSING', 'TRIMS', 'LACE', 'GREIGE_LACE', 'LACE_PROCESSING', 'GENERAL', 'EMBROIDERY_SERVICE', 'WASHING_SERVICE', 'FINISHING_SERVICE', 'CUTTING_SERVICE', 'STITCHING_SERVICE', 'HANDWORK_SERVICE', 'SMOCKING_SERVICE', 'TRANSPORTATION_SERVICE');
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "poCategory" DROP DEFAULT;
ALTER TABLE "purchase_orders" ALTER COLUMN "poCategory" TYPE "POCategory_new" USING ("poCategory"::text::"POCategory_new");
ALTER TYPE "POCategory" RENAME TO "POCategory_old";
ALTER TYPE "POCategory_new" RENAME TO "POCategory";
DROP TYPE "public"."POCategory_old";
ALTER TABLE "purchase_orders" ALTER COLUMN "poCategory" SET DEFAULT 'GENERAL';
COMMIT;

-- AlterEnum: Add PRODUCTION_RUN to POSource
ALTER TYPE "POSource" ADD VALUE 'PRODUCTION_RUN';

-- AlterTable: work_orders (production run split fields)
ALTER TABLE "work_orders" ADD COLUMN "fabricLotInfo" JSONB,
ADD COLUMN "parentRunId" TEXT,
ADD COLUMN "splitReason" TEXT;

-- AlterTable: job_work_orders (challan FKs)
ALTER TABLE "job_work_orders" ADD COLUMN "inwardChallanId" TEXT,
ADD COLUMN "outwardChallanId" TEXT;

-- AlterTable: po_source_links (production run source)
ALTER TABLE "po_source_links" ADD COLUMN "productionRunId" TEXT;

-- AlterTable: processing_delivery (challan FK)
ALTER TABLE "processing_delivery" ADD COLUMN "challanId" TEXT;

-- AlterTable: processing_movement (challan FK)
ALTER TABLE "processing_movement" ADD COLUMN "challanId" TEXT;

-- CreateTable: challans
CREATE TABLE "challans" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "challanType" "ChallanType" NOT NULL,
    "challanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,
    "productionRunId" TEXT,
    "purchaseOrderId" TEXT,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT,
    "toName" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "lrNumber" TEXT,
    "status" "ChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3),
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "remarks" TEXT,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: challan_items
CREATE TABLE "challan_items" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "materialId" TEXT,
    "fabricId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3),
    "damagedQty" DECIMAL(12,3),
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "colorId" TEXT,
    "sizeId" TEXT,
    "rate" DECIMAL(10,2),
    "remarks" TEXT,

    CONSTRAINT "challan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challans_challanNumber_key" ON "challans"("challanNumber");

-- CreateIndex
CREATE INDEX "challans_orderId_idx" ON "challans"("orderId");

-- CreateIndex
CREATE INDEX "challans_productionRunId_idx" ON "challans"("productionRunId");

-- CreateIndex
CREATE INDEX "challans_purchaseOrderId_idx" ON "challans"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "challans_challanType_idx" ON "challans"("challanType");

-- CreateIndex
CREATE INDEX "challans_status_idx" ON "challans"("status");

-- CreateIndex
CREATE INDEX "challans_challanDate_idx" ON "challans"("challanDate");

-- CreateIndex
CREATE INDEX "challan_items_challanId_idx" ON "challan_items"("challanId");

-- CreateIndex
CREATE INDEX "challan_items_itemType_idx" ON "challan_items"("itemType");

-- CreateIndex
CREATE INDEX "job_work_orders_outwardChallanId_idx" ON "job_work_orders"("outwardChallanId");

-- CreateIndex
CREATE INDEX "job_work_orders_inwardChallanId_idx" ON "job_work_orders"("inwardChallanId");

-- CreateIndex
CREATE INDEX "po_source_links_productionRunId_idx" ON "po_source_links"("productionRunId");

-- CreateIndex
CREATE INDEX "processing_delivery_challanId_idx" ON "processing_delivery"("challanId");

-- CreateIndex
CREATE INDEX "processing_movement_challanId_idx" ON "processing_movement"("challanId");

-- CreateIndex
CREATE INDEX "work_orders_parentRunId_idx" ON "work_orders"("parentRunId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_source_links" ADD CONSTRAINT "po_source_links_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_movement" ADD CONSTRAINT "processing_movement_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_delivery" ADD CONSTRAINT "processing_delivery_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_outwardChallanId_fkey" FOREIGN KEY ("outwardChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_inwardChallanId_fkey" FOREIGN KEY ("inwardChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
