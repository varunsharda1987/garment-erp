-- Add finished fabric, than/fold measurement fields to job_work_orders
ALTER TABLE "job_work_orders" ADD COLUMN "finishedFabricId" TEXT;
ALTER TABLE "job_work_orders" ADD COLUMN "thanCount" INTEGER;
ALTER TABLE "job_work_orders" ADD COLUMN "foldLengthCm" DECIMAL(5, 2);
ALTER TABLE "job_work_orders" ADD COLUMN "calculatedActualMeters" DECIMAL(10, 2);

-- Add foreign key constraint
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_finishedFabricId_fkey" FOREIGN KEY ("finishedFabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for the new FK
CREATE INDEX "job_work_orders_finishedFabricId_idx" ON "job_work_orders"("finishedFabricId");
