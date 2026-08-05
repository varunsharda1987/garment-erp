-- CreateEnum
CREATE TYPE "DefectDisposition" AS ENUM ('PENDING', 'SCRAP', 'REWORK_INITIATED', 'REWORK_COMPLETED', 'RETURN_TO_VENDOR', 'DOWNGRADE', 'DISPOSED');

-- CreateTable
CREATE TABLE "reject_dispositions" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "defectDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuttingBatchId" TEXT,
    "stitchingDailyId" TEXT,
    "finishingDailyId" TEXT,
    "qcInspectionId" TEXT,
    "colorId" TEXT,
    "sizeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "defectType" TEXT NOT NULL,
    "defectDescription" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'MAJOR',
    "disposition" "DefectDisposition" NOT NULL DEFAULT 'PENDING',
    "dispositionDate" TIMESTAMP(3),
    "dispositionNotes" TEXT,
    "resolvedById" TEXT,
    "recoveredQuantity" INTEGER NOT NULL DEFAULT 0,
    "reworkNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reject_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reject_dispositions_workOrderId_idx" ON "reject_dispositions"("workOrderId");

-- CreateIndex
CREATE INDEX "reject_dispositions_stage_idx" ON "reject_dispositions"("stage");

-- CreateIndex
CREATE INDEX "reject_dispositions_disposition_idx" ON "reject_dispositions"("disposition");

-- CreateIndex
CREATE INDEX "reject_dispositions_defectDate_idx" ON "reject_dispositions"("defectDate");

-- CreateIndex
CREATE INDEX "reject_dispositions_cuttingBatchId_idx" ON "reject_dispositions"("cuttingBatchId");

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reject_dispositions" ADD CONSTRAINT "reject_dispositions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
