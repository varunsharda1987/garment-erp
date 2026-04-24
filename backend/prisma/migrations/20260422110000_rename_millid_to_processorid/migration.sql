-- Rename millId/processingMillId to processorId in lab_dips, job_work_orders, and fabric_processing
-- This aligns naming with other processor references (fabric_costing, mrp_requirement, greige_stock)

-- Step 1: Rename column in lab_dips
ALTER TABLE "lab_dips" RENAME COLUMN "millId" TO "processorId";

-- Step 2: Rename column in job_work_orders
ALTER TABLE "job_work_orders" RENAME COLUMN "millId" TO "processorId";

-- Step 3: Rename column in fabric_processing
ALTER TABLE "fabric_processing" RENAME COLUMN "processingMillId" TO "processorId";

-- Step 4: Drop old indexes
DROP INDEX IF EXISTS "job_work_orders_millId_idx";
DROP INDEX IF EXISTS "fabric_processing_processingMillId_greigeId_idx";

-- Step 5: Create new indexes
CREATE INDEX IF NOT EXISTS "job_work_orders_processorId_idx" ON "job_work_orders"("processorId");
CREATE INDEX IF NOT EXISTS "fabric_processing_processorId_greigeId_idx" ON "fabric_processing"("processorId", "greigeId");
