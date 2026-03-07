-- Make fabricId optional for GREIGE_PROCESSED items (no fabric_master needed)
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "fabricId" DROP NOT NULL;

-- Add defaults for numeric fields so they're not required on insert
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "width" SET DEFAULT 0;
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "cadMeters" SET DEFAULT 0;
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "effectiveCad" SET DEFAULT 0;
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "costPerMeter" SET DEFAULT 0;
ALTER TABLE "style_costing_fabric_items" ALTER COLUMN "totalCost" SET DEFAULT 0;

-- Add greigeId FK for GREIGE_PROCESSED sourcing strategy
ALTER TABLE "style_costing_fabric_items" ADD COLUMN IF NOT EXISTS "greigeId" TEXT;

-- Add FK constraint for greigeId
ALTER TABLE "style_costing_fabric_items" ADD CONSTRAINT "style_costing_fabric_items_greigeId_fkey" FOREIGN KEY ("greigeId") REFERENCES "greige_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
