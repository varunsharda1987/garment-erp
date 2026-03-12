-- Add fabricProcessingId to challans
ALTER TABLE "challans" ADD COLUMN IF NOT EXISTS "fabricProcessingId" TEXT;
CREATE INDEX IF NOT EXISTS "challans_fabricProcessingId_idx" ON "challans"("fabricProcessingId");

-- Add greigeStockId and materialRequirementId to challan_items
ALTER TABLE "challan_items" ADD COLUMN IF NOT EXISTS "greigeStockId" VARCHAR(50);
ALTER TABLE "challan_items" ADD COLUMN IF NOT EXISTS "materialRequirementId" TEXT;
CREATE INDEX IF NOT EXISTS "challan_items_greigeStockId_idx" ON "challan_items"("greigeStockId");
CREATE INDEX IF NOT EXISTS "challan_items_materialRequirementId_idx" ON "challan_items"("materialRequirementId");

-- Make fabric_processing fields optional for MRP-driven processing
ALTER TABLE "fabric_processing" ALTER COLUMN "procurementId" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "greigeWidth" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "expectedFinishedWidthMin" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "expectedFinishedWidthMax" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "expectedShrinkagePercent" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "greigeCost" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "processingCost" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "totalFinishedCost" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "costPerMeter" DROP NOT NULL;
ALTER TABLE "fabric_processing" ALTER COLUMN "sentDate" DROP NOT NULL;
