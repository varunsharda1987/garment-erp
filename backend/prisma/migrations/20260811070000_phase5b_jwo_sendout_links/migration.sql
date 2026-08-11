-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionReferenceType" ADD VALUE 'JOB_WORK_ORDER';
ALTER TYPE "TransactionReferenceType" ADD VALUE 'EXTERNAL_PROCESS';

-- AlterTable
ALTER TABLE "external_process_send_outs" ADD COLUMN     "jobWorkOrderId" TEXT;

-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "embroideryId" TEXT;

-- AlterTable
ALTER TABLE "processing_stage" ADD COLUMN     "jobWorkOrderId" TEXT;

-- CreateIndex
CREATE INDEX "external_process_send_outs_jobWorkOrderId_idx" ON "external_process_send_outs"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "job_work_orders_embroideryId_idx" ON "job_work_orders"("embroideryId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_stage_jobWorkOrderId_key" ON "processing_stage"("jobWorkOrderId");

-- AddForeignKey
ALTER TABLE "processing_stage" ADD CONSTRAINT "processing_stage_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_embroideryId_fkey" FOREIGN KEY ("embroideryId") REFERENCES "embroidery_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

