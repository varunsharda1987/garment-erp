-- Add source tracking columns to greige_stock
ALTER TABLE "greige_stock" ADD COLUMN IF NOT EXISTS "sourceChallanId" VARCHAR(50);
ALTER TABLE "greige_stock" ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR(20);

-- Add foreign key constraint for sourceChallan
ALTER TABLE "greige_stock" DROP CONSTRAINT IF EXISTS "greige_stock_sourceChallanId_fkey";
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_sourceChallanId_fkey"
  FOREIGN KEY ("sourceChallanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update the unique constraint to include supplierId
-- First drop the old constraint if it exists
ALTER TABLE "greige_stock" DROP CONSTRAINT IF EXISTS "greige_stock_greigeId_procurementId_greigeWidth_qualityGra_key";

-- Create new unique constraint with supplierId
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_greigeId_procurementId_greigeWidth_qualityGra_key"
  UNIQUE ("greigeId", "procurementId", "greigeWidth", "qualityGrade", "supplierId");

-- Add index on sourceChallanId for performance
CREATE INDEX IF NOT EXISTS "greige_stock_sourceChallanId_idx" ON "greige_stock"("sourceChallanId");
CREATE INDEX IF NOT EXISTS "greige_stock_supplierId_idx" ON "greige_stock"("supplierId");
