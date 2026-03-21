-- DropForeignKey
ALTER TABLE "cutting_batch_skus" DROP CONSTRAINT "cutting_batch_skus_colorId_fkey";

-- DropForeignKey
ALTER TABLE "cutting_lay_skus" DROP CONSTRAINT "cutting_lay_skus_colorId_fkey";

-- DropForeignKey
ALTER TABLE "fabric_processing" DROP CONSTRAINT "fabric_processing_procurementId_fkey";

-- DropForeignKey
ALTER TABLE "finishing_issue_skus" DROP CONSTRAINT "finishing_issue_skus_colorId_fkey";

-- DropForeignKey
ALTER TABLE "finishing_issues" DROP CONSTRAINT "finishing_issues_managerId_fkey";

-- DropForeignKey
ALTER TABLE "stitching_issue_skus" DROP CONSTRAINT "stitching_issue_skus_colorId_fkey";

-- DropForeignKey
ALTER TABLE "stitching_issues" DROP CONSTRAINT "stitching_issues_managerId_fkey";

-- DropForeignKey
ALTER TABLE "transfer_slip_skus" DROP CONSTRAINT "transfer_slip_skus_colorId_fkey";

-- DropForeignKey
ALTER TABLE "transfer_slips" DROP CONSTRAINT "transfer_slips_issuedToId_fkey";

-- AlterTable
ALTER TABLE "challan_items" ALTER COLUMN "greigeStockId" SET DATA TYPE TEXT,
ALTER COLUMN "fabricStockId" SET DATA TYPE TEXT,
ALTER COLUMN "laceStockId" SET DATA TYPE TEXT,
ALTER COLUMN "serviceRequirementId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "credit_note_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credit_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "debit_note_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "debit_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "finishing_issues_contractorId_idx" ON "finishing_issues"("contractorId");

-- CreateIndex
CREATE INDEX "stitching_issues_contractorId_idx" ON "stitching_issues"("contractorId");

-- AddForeignKey
ALTER TABLE "fabric_processing" ADD CONSTRAINT "fabric_processing_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batch_skus" ADD CONSTRAINT "cutting_batch_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_issuedToId_fkey" FOREIGN KEY ("issuedToId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_slip_skus" ADD CONSTRAINT "transfer_slip_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issues" ADD CONSTRAINT "stitching_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_skus" ADD CONSTRAINT "stitching_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issues" ADD CONSTRAINT "finishing_issues_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_skus" ADD CONSTRAINT "finishing_issue_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_fabricProcessingId_fkey" FOREIGN KEY ("fabricProcessingId") REFERENCES "fabric_processing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_greigeStockId_fkey" FOREIGN KEY ("greigeStockId") REFERENCES "greige_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_laceStockId_fkey" FOREIGN KEY ("laceStockId") REFERENCES "lace_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_materialRequirementId_fkey" FOREIGN KEY ("materialRequirementId") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "work_order_service_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
