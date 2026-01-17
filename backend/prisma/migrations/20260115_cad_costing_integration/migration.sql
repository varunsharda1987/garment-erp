-- CAD Planning, Fabric Costing, Cost Sheet & Orders Integration Migration
-- This migration implements the mode renaming and new approval workflows

-- ============================================
-- STEP 1: Create new CAD Purpose enum
-- ============================================
-- New mode names: COSTING (was PLANNING), RAW_MATERIAL_CALCULATION (was COSTING), PRODUCTION (unchanged)

-- Add new enum type for CAD purpose
DO $$ BEGIN
    CREATE TYPE "CadPurpose" AS ENUM ('COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add temporary column for purpose enum
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "purpose_enum" "CadPurpose";

-- Migrate existing data from string to enum
UPDATE "fabric_width_cad"
SET "purpose_enum" = CASE
    WHEN "purpose" = 'PLANNING' THEN 'COSTING'::"CadPurpose"
    WHEN "purpose" = 'COSTING' THEN 'RAW_MATERIAL_CALCULATION'::"CadPurpose"
    WHEN "purpose" = 'PRODUCTION' THEN 'PRODUCTION'::"CadPurpose"
    ELSE NULL
END
WHERE "purpose" IS NOT NULL;

-- ============================================
-- STEP 2: Add Cost Sheet Approval Status
-- ============================================
-- Add approval status enum for cost sheets
DO $$ BEGIN
    CREATE TYPE "CostSheetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add approval status column to style_costing
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "approval_status" "CostSheetApprovalStatus" DEFAULT 'PENDING';

-- Migrate existing approved costings
UPDATE "style_costing"
SET "approval_status" = CASE
    WHEN "isApproved" = true THEN 'APPROVED'::"CostSheetApprovalStatus"
    ELSE 'PENDING'::"CostSheetApprovalStatus"
END;

-- Add rejection notes field
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "rejection_notes" TEXT;

-- ============================================
-- STEP 3: Add Variance Approval fields
-- ============================================
-- For PRODUCTION mode variance tracking

-- Variance approval status enum
DO $$ BEGIN
    CREATE TYPE "VarianceApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add variance approval fields to fabric_width_cad
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "variance_approval_status" "VarianceApprovalStatus" DEFAULT 'NOT_REQUIRED';
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "variance_approved_by" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "variance_approved_at" TIMESTAMP(3);
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "variance_approval_notes" TEXT;

-- ============================================
-- STEP 4: Add Greige Rate Source tracking
-- ============================================
-- Track where the greige rate came from

DO $$ BEGIN
    CREATE TYPE "GreigeRateSource" AS ENUM ('PROCUREMENT', 'STOCK_VALUATION', 'GREIGE_MASTER', 'MANUAL_OVERRIDE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "greige_rate_source" "GreigeRateSource";
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "greige_rate_source_date" TIMESTAMP(3);
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "greige_rate_manual_override" DECIMAL(10, 2);
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "greige_rate_override_reason" TEXT;

-- ============================================
-- STEP 5: Add Order Costing Snapshot fields
-- ============================================
-- Order stores a snapshot of costing data

ALTER TABLE "order_item_costing" ADD COLUMN IF NOT EXISTS "costing_snapshot" JSONB;
ALTER TABLE "order_item_costing" ADD COLUMN IF NOT EXISTS "snapshot_created_at" TIMESTAMP(3);
ALTER TABLE "order_item_costing" ADD COLUMN IF NOT EXISTS "original_cost_sheet_version" INT;

-- ============================================
-- STEP 6: Add fields for RAW_MAT cloning
-- ============================================
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "cloned_from_order_id" TEXT;
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "cloned_from_cad_id" TEXT;

-- ============================================
-- STEP 7: Add Cost Sheet width combination identifier
-- ============================================
-- To track which width combination a cost sheet represents
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "width_combination_hash" TEXT;
ALTER TABLE "style_costing" ADD COLUMN IF NOT EXISTS "width_combination_description" TEXT;

-- ============================================
-- STEP 8: Create indexes for new fields
-- ============================================
CREATE INDEX IF NOT EXISTS "fabric_width_cad_variance_approval_status_idx" ON "fabric_width_cad"("variance_approval_status");
CREATE INDEX IF NOT EXISTS "fabric_width_cad_greige_rate_source_idx" ON "fabric_width_cad"("greige_rate_source");
CREATE INDEX IF NOT EXISTS "fabric_width_cad_cloned_from_order_idx" ON "fabric_width_cad"("cloned_from_order_id");
CREATE INDEX IF NOT EXISTS "style_costing_approval_status_idx" ON "style_costing"("approval_status");
CREATE INDEX IF NOT EXISTS "style_costing_width_combination_hash_idx" ON "style_costing"("width_combination_hash");

-- ============================================
-- STEP 9: Add foreign key for variance approver
-- ============================================
ALTER TABLE "fabric_width_cad"
ADD CONSTRAINT "fabric_width_cad_variance_approved_by_fkey"
FOREIGN KEY ("variance_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- STEP 10: Add foreign key for cloned CAD
-- ============================================
ALTER TABLE "fabric_width_cad"
ADD CONSTRAINT "fabric_width_cad_cloned_from_cad_fkey"
FOREIGN KEY ("cloned_from_cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fabric_width_cad"
ADD CONSTRAINT "fabric_width_cad_cloned_from_order_fkey"
FOREIGN KEY ("cloned_from_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
