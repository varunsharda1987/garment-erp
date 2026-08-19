-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "colorMasterId" TEXT,
ADD COLUMN     "colorName" TEXT;

-- CreateIndex
CREATE INDEX "job_work_orders_colorMasterId_idx" ON "job_work_orders"("colorMasterId");

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_colorMasterId_fkey" FOREIGN KEY ("colorMasterId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
