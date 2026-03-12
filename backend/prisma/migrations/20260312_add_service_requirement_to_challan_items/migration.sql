-- Add serviceRequirementId to challan_items for process/service traceability
ALTER TABLE "challan_items" ADD COLUMN IF NOT EXISTS "serviceRequirementId" VARCHAR(255);
CREATE INDEX IF NOT EXISTS "challan_items_serviceRequirementId_idx" ON "challan_items"("serviceRequirementId");
