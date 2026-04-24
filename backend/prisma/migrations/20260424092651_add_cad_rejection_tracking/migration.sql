-- DropIndex
DROP INDEX "greige_stock_processorId_idx";

-- DropIndex
DROP INDEX "processor_rate_card_processorId_processingType_printingType_key";

-- AlterTable
ALTER TABLE "fabric_width_cad" ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" TEXT,
ALTER COLUMN "approval_status" SET DEFAULT 'PENDING';

-- RenameForeignKey
ALTER TABLE "fabric_processing" RENAME CONSTRAINT "fabric_processing_processingMillId_fkey" TO "fabric_processing_processorId_fkey";

-- RenameForeignKey
ALTER TABLE "job_work_orders" RENAME CONSTRAINT "job_work_orders_millId_fkey" TO "job_work_orders_processorId_fkey";

-- RenameForeignKey
ALTER TABLE "lab_dips" RENAME CONSTRAINT "lab_dips_millId_fkey" TO "lab_dips_processorId_fkey";

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "processor_rate_card_processorId_processingType_effectiveFrom_id" RENAME TO "processor_rate_card_processorId_processingType_effectiveFro_idx";

-- RenameIndex
ALTER INDEX "unique_rate_card_v4" RENAME TO "processor_rate_card_processorId_processingType_printingType_key";
