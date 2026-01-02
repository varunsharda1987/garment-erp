-- Migration: Add CAD Purposes (PRODUCTION, PLANNING, COSTING) with Approval, Versioning, and Stock Integration
-- Date: 2025-01-01
-- Purpose: Implement three separate CAD purposes with distinct workflows

-- Step 1: Add Approval Workflow Fields (for all purposes)
ALTER TABLE "fabric_width_cad" ADD COLUMN "approval_status" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "fabric_width_cad" ADD COLUMN "approval_notes" TEXT;

-- Step 2: Add Locking Mechanism (for PRODUCTION purpose)
ALTER TABLE "fabric_width_cad" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fabric_width_cad" ADD COLUMN "locked_reason" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN "locked_at" TIMESTAMP(3);

-- Step 3: Add Version Control (for PLANNING purpose)
ALTER TABLE "fabric_width_cad" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "fabric_width_cad" ADD COLUMN "superseded_by_id" TEXT;

-- Step 4: Add Stock Integration (for PRODUCTION purpose)
ALTER TABLE "fabric_width_cad" ADD COLUMN "fabric_stock_id" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN "procurement_id" TEXT;

-- Step 5: Add Variance Tracking (PRODUCTION vs PLANNING)
ALTER TABLE "fabric_width_cad" ADD COLUMN "planning_cad_width" DECIMAL(10, 2);
ALTER TABLE "fabric_width_cad" ADD COLUMN "width_variance" DECIMAL(10, 2);
ALTER TABLE "fabric_width_cad" ADD COLUMN "variance_percent" DECIMAL(5, 2);

-- Step 6: Add Costing Integration (for COSTING purpose)
ALTER TABLE "fabric_width_cad" ADD COLUMN "style_costing_id" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN "auto_approved_from" TEXT;

-- Step 7: Add Foreign Key Constraints
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_fabric_stock_id_fkey"
  FOREIGN KEY ("fabric_stock_id") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_procurement_id_fkey"
  FOREIGN KEY ("procurement_id") REFERENCES "fabric_procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_style_costing_id_fkey"
  FOREIGN KEY ("style_costing_id") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 8: Add Indexes for Performance
CREATE INDEX "fabric_width_cad_approval_status_idx" ON "fabric_width_cad"("approval_status");
CREATE INDEX "fabric_width_cad_is_locked_idx" ON "fabric_width_cad"("is_locked");
CREATE INDEX "fabric_width_cad_version_idx" ON "fabric_width_cad"("version");
CREATE INDEX "fabric_width_cad_superseded_by_id_idx" ON "fabric_width_cad"("superseded_by_id");
CREATE INDEX "fabric_width_cad_fabric_stock_id_idx" ON "fabric_width_cad"("fabric_stock_id");
CREATE INDEX "fabric_width_cad_procurement_id_idx" ON "fabric_width_cad"("procurement_id");
CREATE INDEX "fabric_width_cad_style_costing_id_idx" ON "fabric_width_cad"("style_costing_id");

-- Step 9: Data Migration - Set default values for existing records
-- All existing CAD records will be treated as PRODUCTION purpose (if purpose is not set)
UPDATE "fabric_width_cad"
SET "purpose" = 'PRODUCTION'
WHERE "purpose" IS NULL;

-- Set approval_status to APPROVED for existing CAD records (assume they were already in use)
UPDATE "fabric_width_cad"
SET "approval_status" = 'APPROVED',
    "auto_approved_from" = 'DATA_MIGRATION'
WHERE "purpose" = 'PRODUCTION' AND "approval_status" IS NULL;

-- Step 10: Add Comments for Documentation
COMMENT ON COLUMN "fabric_width_cad"."approval_status" IS 'Approval status: PENDING, APPROVED, REJECTED (used for all purposes)';
COMMENT ON COLUMN "fabric_width_cad"."approved_by" IS 'User ID who approved this CAD (Admin/Merchandiser for PRODUCTION, Designer for PLANNING)';
COMMENT ON COLUMN "fabric_width_cad"."is_locked" IS 'Locked flag for PRODUCTION CAD when used in orders (prevents editing)';
COMMENT ON COLUMN "fabric_width_cad"."version" IS 'Version number for PLANNING CAD (v1, v2, v3...) - supports version history';
COMMENT ON COLUMN "fabric_width_cad"."superseded_by_id" IS 'Points to newer version if this CAD has been superseded (PLANNING only)';
COMMENT ON COLUMN "fabric_width_cad"."fabric_stock_id" IS 'Links to actual fabric stock for PRODUCTION CAD (uses actual widths)';
COMMENT ON COLUMN "fabric_width_cad"."procurement_id" IS 'Links to procurement for traceability (PRODUCTION only)';
COMMENT ON COLUMN "fabric_width_cad"."planning_cad_width" IS 'Original PLANNING CAD width for variance tracking';
COMMENT ON COLUMN "fabric_width_cad"."width_variance" IS 'Variance: actualWidth - planningWidth (in inches)';
COMMENT ON COLUMN "fabric_width_cad"."variance_percent" IS 'Variance percentage: (actualWidth - planningWidth) / planningWidth * 100';
COMMENT ON COLUMN "fabric_width_cad"."style_costing_id" IS 'Links to style costing sheet (COSTING purpose only)';
COMMENT ON COLUMN "fabric_width_cad"."auto_approved_from" IS 'Auto-approval source: COSTING_SHEET, MANUAL, DATA_MIGRATION';
