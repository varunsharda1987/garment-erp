-- Migration: Add fields for style-fabric import functionality
-- Date: 2025-01-21

-- =====================================================
-- Add new fields to styles table
-- =====================================================
ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "projectGroup" TEXT;

-- =====================================================
-- Add new fields to fabric_master table
-- =====================================================
ALTER TABLE "fabric_master" ADD COLUMN IF NOT EXISTS "styleReference" TEXT;
ALTER TABLE "fabric_master" ADD COLUMN IF NOT EXISTS "isGeneric" BOOLEAN DEFAULT false;
ALTER TABLE "fabric_master" ADD COLUMN IF NOT EXISTS "componentType" TEXT;

-- =====================================================
-- Add new fields to fabric_width_cad table
-- =====================================================
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "actualCad" DECIMAL(10,4);
ALTER TABLE "fabric_width_cad" ADD COLUMN IF NOT EXISTS "cadVariancePercent" DECIMAL(5,2);

-- =====================================================
-- Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS "idx_fabric_stock_origin_style" ON "fabric_stock"("originStyleId");
CREATE INDEX IF NOT EXISTS "idx_fabric_master_style_ref" ON "fabric_master"("styleReference");
CREATE INDEX IF NOT EXISTS "idx_style_fabrics_fabric_id" ON "style_fabrics"("fabricId");
CREATE INDEX IF NOT EXISTS "idx_styles_project_group" ON "styles"("projectGroup");

-- =====================================================
-- Create style_import_staging table
-- =====================================================
CREATE TABLE IF NOT EXISTS "style_import_staging" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- Original CSV columns
    "styleCode" TEXT NOT NULL,
    "projectGroup" TEXT,
    "itemDescription" TEXT NOT NULL,
    "customer" TEXT,
    "season" TEXT,
    "gender" TEXT,
    "category" TEXT,
    "componentName" TEXT NOT NULL,
    "fabricDescription" TEXT NOT NULL,
    "cadAverage" DECIMAL(10,4),
    "lastProductionAverage" DECIMAL(10,4),
    "fabricWidth" DECIMAL(10,2),

    -- Generated fields
    "generatedFabricCode" TEXT,
    "generatedFabricName" TEXT,

    -- Import metadata
    "importBatchId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    -- Links to created records
    "createdStyleId" TEXT,
    "createdFabricId" TEXT,
    "createdComponentId" TEXT
);

-- =====================================================
-- Create indexes for staging table
-- =====================================================
CREATE INDEX IF NOT EXISTS "idx_staging_batch" ON "style_import_staging"("importBatchId");
CREATE INDEX IF NOT EXISTS "idx_staging_status" ON "style_import_staging"("status");
CREATE INDEX IF NOT EXISTS "idx_staging_style_code" ON "style_import_staging"("styleCode");
