-- CreateEnum
CREATE TYPE "ExternalProcessType" AS ENUM ('EMBROIDERY_PIECE', 'SMOCKING', 'HANDWORK');

-- CreateEnum
CREATE TYPE "ExternalProcessSourceType" AS ENUM ('CUTTING_BATCH', 'FABRIC_STOCK', 'STITCHING_ISSUE');

-- CreateEnum
CREATE TYPE "ExternalProcessStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ProductionStage" ADD VALUE 'IN_SMOCKING';

-- AlterTable
ALTER TABLE "style_production_tracking" ADD COLUMN     "piecesInSmocking" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "external_process_send_outs" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "processType" "ExternalProcessType" NOT NULL,
    "sourceType" "ExternalProcessSourceType" NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "orderId" TEXT,
    "styleId" TEXT,
    "cuttingBatchId" TEXT,
    "fabricStockId" TEXT,
    "stitchingIssueId" TEXT,
    "supplierId" TEXT NOT NULL,
    "quantitySent" DECIMAL(10,2) NOT NULL,
    "quantityReceived" DECIMAL(10,2),
    "quantityDamaged" DECIMAL(10,2),
    "quantityGood" DECIMAL(10,2),
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "agreedRate" DECIMAL(10,2) NOT NULL,
    "actualCost" DECIMAL(10,2),
    "sendDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "purchaseOrderId" TEXT,
    "serviceRequirementId" TEXT,
    "outwardChallanId" TEXT,
    "inwardChallanId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "status" "ExternalProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "embroideryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "external_process_send_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_process_send_out_skus" (
    "id" TEXT NOT NULL,
    "sendOutId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "sentQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "goodQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "external_process_send_out_skus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_process_send_outs_batchNumber_key" ON "external_process_send_outs"("batchNumber");

-- CreateIndex
CREATE INDEX "external_process_send_outs_processType_idx" ON "external_process_send_outs"("processType");

-- CreateIndex
CREATE INDEX "external_process_send_outs_workOrderId_idx" ON "external_process_send_outs"("workOrderId");

-- CreateIndex
CREATE INDEX "external_process_send_outs_supplierId_idx" ON "external_process_send_outs"("supplierId");

-- CreateIndex
CREATE INDEX "external_process_send_outs_status_idx" ON "external_process_send_outs"("status");

-- CreateIndex
CREATE INDEX "external_process_send_outs_sendDate_idx" ON "external_process_send_outs"("sendDate");

-- CreateIndex
CREATE INDEX "external_process_send_outs_cuttingBatchId_idx" ON "external_process_send_outs"("cuttingBatchId");

-- CreateIndex
CREATE INDEX "external_process_send_outs_stitchingIssueId_idx" ON "external_process_send_outs"("stitchingIssueId");

-- CreateIndex
CREATE INDEX "external_process_send_outs_purchaseOrderId_idx" ON "external_process_send_outs"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "external_process_send_outs_processType_status_idx" ON "external_process_send_outs"("processType", "status");

-- CreateIndex
CREATE INDEX "external_process_send_out_skus_sendOutId_idx" ON "external_process_send_out_skus"("sendOutId");

-- CreateIndex
CREATE UNIQUE INDEX "external_process_send_out_skus_sendOutId_colorId_sizeId_key" ON "external_process_send_out_skus"("sendOutId", "colorId", "sizeId");

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "stitching_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "work_order_service_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_out_skus" ADD CONSTRAINT "external_process_send_out_skus_sendOutId_fkey" FOREIGN KEY ("sendOutId") REFERENCES "external_process_send_outs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_out_skus" ADD CONSTRAINT "external_process_send_out_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_out_skus" ADD CONSTRAINT "external_process_send_out_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
