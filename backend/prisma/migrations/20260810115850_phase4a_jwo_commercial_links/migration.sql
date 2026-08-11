-- AlterTable
ALTER TABLE "challans" ADD COLUMN     "jobWorkOrderId" TEXT;

-- AlterTable
ALTER TABLE "debit_notes" ADD COLUMN     "jobWorkOrderId" TEXT;

-- AlterTable
ALTER TABLE "goods_receiving_notes" ADD COLUMN     "jobWorkOrderId" TEXT;

-- CreateTable
CREATE TABLE "requirement_jwo_links" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "jobWorkOrderId" TEXT NOT NULL,
    "allocatedQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_jwo_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_jwo_links_jobWorkOrderId_idx" ON "requirement_jwo_links"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "requirement_jwo_links_requirementId_idx" ON "requirement_jwo_links"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_jwo_links_requirementId_jobWorkOrderId_key" ON "requirement_jwo_links"("requirementId", "jobWorkOrderId");

-- CreateIndex
CREATE INDEX "challans_jobWorkOrderId_idx" ON "challans"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "debit_notes_jobWorkOrderId_idx" ON "debit_notes"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_jobWorkOrderId_idx" ON "goods_receiving_notes"("jobWorkOrderId");

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_jwo_links" ADD CONSTRAINT "requirement_jwo_links_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "material_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_jwo_links" ADD CONSTRAINT "requirement_jwo_links_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
