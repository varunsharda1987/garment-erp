-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "finishedLaceId" TEXT,
ADD COLUMN     "greigeLaceId" TEXT;

-- CreateIndex
CREATE INDEX "job_work_orders_greigeLaceId_idx" ON "job_work_orders"("greigeLaceId");

-- CreateIndex
CREATE INDEX "job_work_orders_finishedLaceId_idx" ON "job_work_orders"("finishedLaceId");

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_finishedLaceId_fkey" FOREIGN KEY ("finishedLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
