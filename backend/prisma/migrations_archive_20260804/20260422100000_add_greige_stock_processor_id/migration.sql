-- Add processorId column to greige_stock
-- This field tracks the processor currently holding the stock (set on TRANSFER)
-- supplierId remains the original supplier who SOLD the greige (immutable)

-- Step 1: Add the processorId column
ALTER TABLE "greige_stock" ADD COLUMN "processorId" VARCHAR(50);

-- Step 2: For existing TRANSFER records, move supplierId to processorId
-- (because the old code incorrectly set supplierId to the processor)
UPDATE "greige_stock"
SET "processorId" = "supplierId"
WHERE "sourceType" = 'TRANSFER' AND "supplierId" IS NOT NULL;

-- Step 3: Try to recover original supplier from source challan chain
-- The source challan's items reference the original greige stock entry
UPDATE "greige_stock" gs
SET "supplierId" = (
  SELECT original."supplierId"
  FROM "challans" c
  INNER JOIN "challan_items" ci ON ci."challanId" = c."id"
  INNER JOIN "greige_stock" original ON original."id" = ci."greigeStockId"
  WHERE c."id" = gs."sourceChallanId"
    AND original."sourceType" IS DISTINCT FROM 'TRANSFER'
    AND original."supplierId" IS NOT NULL
  LIMIT 1
)
WHERE gs."sourceType" = 'TRANSFER'
  AND gs."sourceChallanId" IS NOT NULL;

-- Step 4: Drop old unique constraint
ALTER TABLE "greige_stock" DROP CONSTRAINT IF EXISTS "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key";

-- Step 5: Create new unique constraint including processorId
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key"
  UNIQUE ("greigeId", "procurementId", "greigeWidth", "qualityGrade", "supplierId", "processorId");

-- Step 6: Add foreign key constraint for processorId -> suppliers
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_processorId_fkey"
  FOREIGN KEY ("processorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Add index for processorId for faster queries
CREATE INDEX IF NOT EXISTS "greige_stock_processorId_idx" ON "greige_stock"("processorId");
