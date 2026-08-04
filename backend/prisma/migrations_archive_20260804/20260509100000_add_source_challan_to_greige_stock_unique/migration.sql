-- Add sourceChallanId to greige_stock unique constraint
-- This allows multiple issues of the same greige to the same processor via different challans
-- Each challan represents a different processing job (different color dyeing, different print, etc.)

-- Drop the unique constraint (which also drops the underlying index)
ALTER TABLE "greige_stock" DROP CONSTRAINT IF EXISTS "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key";

-- Create new unique index with sourceChallanId
CREATE UNIQUE INDEX "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key" ON "greige_stock"("greigeId", "procurementId", "greigeWidth", "qualityGrade", "supplierId", "processorId", "sourceChallanId");
