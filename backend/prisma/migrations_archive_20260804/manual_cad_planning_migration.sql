-- CAD Planning Schema Migration
-- This migration renames width fields and adds new CAD planning columns

-- ============================================
-- 1. fabric_width_cad: Rename availableWidth → cutableWidth, add new fields
-- ============================================
ALTER TABLE fabric_width_cad RENAME COLUMN "availableWidth" TO "cutableWidth";
ALTER TABLE fabric_width_cad ADD COLUMN IF NOT EXISTS "layerMarginMeters" DECIMAL(10,4);
ALTER TABLE fabric_width_cad ADD COLUMN IF NOT EXISTS "greigeId" VARCHAR(255);
ALTER TABLE fabric_width_cad ADD COLUMN IF NOT EXISTS "processingPricePerMeter" DECIMAL(10,2);
ALTER TABLE fabric_width_cad ADD COLUMN IF NOT EXISTS "componentName" VARCHAR(255);

-- Drop old unique constraint and create new one
ALTER TABLE fabric_width_cad DROP CONSTRAINT IF EXISTS "fabric_width_cad_fabricId_availableWidth_key";
ALTER TABLE fabric_width_cad ADD CONSTRAINT "fabric_width_cad_fabricId_cutableWidth_componentName_key"
  UNIQUE ("fabricId", "cutableWidth", "componentName");

-- Add index for greigeId
CREATE INDEX IF NOT EXISTS "fabric_width_cad_greigeId_idx" ON fabric_width_cad("greigeId");

-- Add foreign key for greige
ALTER TABLE fabric_width_cad
  ADD CONSTRAINT "fabric_width_cad_greigeId_fkey"
  FOREIGN KEY ("greigeId") REFERENCES greige_master(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2. style_fabrics: Rename usableWidth → cutableWidth, add new fields, delete fabricWidth
-- ============================================
-- Rename usableWidth to cutableWidth
ALTER TABLE style_fabrics RENAME COLUMN "usableWidth" TO "cutableWidth";

-- Add new columns
ALTER TABLE style_fabrics ADD COLUMN IF NOT EXISTS "averagingMode" VARCHAR(20) DEFAULT 'COMBINED';
ALTER TABLE style_fabrics ADD COLUMN IF NOT EXISTS "selectedGreigeId" VARCHAR(255);

-- Drop deprecated fabricWidth column
ALTER TABLE style_fabrics DROP COLUMN IF EXISTS "fabricWidth";

-- Add index for selectedGreigeId
CREATE INDEX IF NOT EXISTS "style_fabrics_selectedGreigeId_idx" ON style_fabrics("selectedGreigeId");

-- Add foreign key for selectedGreige
ALTER TABLE style_fabrics
  ADD CONSTRAINT "style_fabrics_selectedGreigeId_fkey"
  FOREIGN KEY ("selectedGreigeId") REFERENCES greige_master(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. embroidery_master: Delete minFabricWidth, rename usableWidthAfter → cutableWidth
-- ============================================
ALTER TABLE embroidery_master DROP COLUMN IF EXISTS "minFabricWidth";
ALTER TABLE embroidery_master RENAME COLUMN "usableWidthAfter" TO "cutableWidth";

-- ============================================
-- 4. embroidery_send_out: Rename sentWidth → sentFinishedWidth, receivedWidth → receivedCutableWidth
-- ============================================
ALTER TABLE embroidery_send_out RENAME COLUMN "sentWidth" TO "sentFinishedWidth";
ALTER TABLE embroidery_send_out RENAME COLUMN "receivedWidth" TO "receivedCutableWidth";

-- ============================================
-- 5. fabric_stock: Rename width → finishedWidth, add cutableWidth
-- ============================================
ALTER TABLE fabric_stock RENAME COLUMN "width" TO "finishedWidth";
ALTER TABLE fabric_stock ADD COLUMN IF NOT EXISTS "cutableWidth" DECIMAL(10,2);

-- Set default cutableWidth = finishedWidth - 2 for existing rows
UPDATE fabric_stock SET "cutableWidth" = "finishedWidth" - 2 WHERE "cutableWidth" IS NULL;

-- Make cutableWidth NOT NULL after populating
ALTER TABLE fabric_stock ALTER COLUMN "cutableWidth" SET NOT NULL;

-- Drop old unique constraint and create new one
ALTER TABLE fabric_stock DROP CONSTRAINT IF EXISTS "fabric_stock_fabricId_procurementId_width_qualityGrade_embroi_key";
ALTER TABLE fabric_stock ADD CONSTRAINT "fabric_stock_fabricId_procurementId_finishedWidth_cutableWidth_key"
  UNIQUE ("fabricId", "procurementId", "finishedWidth", "cutableWidth", "qualityGrade", "embroideryId");

-- Drop old index and create new one
DROP INDEX IF EXISTS "fabric_stock_fabricId_width_status_idx";
CREATE INDEX IF NOT EXISTS "fabric_stock_fabricId_finishedWidth_cutableWidth_status_idx"
  ON fabric_stock("fabricId", "finishedWidth", "cutableWidth", "status");

-- ============================================
-- Done!
-- ============================================
