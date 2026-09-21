-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "greigeId" TEXT;

-- CreateIndex
CREATE INDEX "job_work_orders_greigeId_idx" ON "job_work_orders"("greigeId");

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
