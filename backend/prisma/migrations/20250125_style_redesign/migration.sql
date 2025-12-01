-- Migration: Style Page Redesign
-- Date: 2025-01-25
-- Description: Add new tables and fields for the redesigned style workflow

-- =====================================================
-- 1. CREATE NEW TABLE: customer_accessories
-- =====================================================
CREATE TABLE "customer_accessories" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accessoryType" TEXT NOT NULL CHECK ("accessoryType" IN ('GARMENT', 'PACKAGING')),
    "itemName" TEXT NOT NULL,
    "itemCategory" TEXT,
    "specification" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accessories_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "customer_accessories_customerId_accessoryType_idx" ON "customer_accessories"("customerId", "accessoryType");

-- Add foreign key constraint
ALTER TABLE "customer_accessories" ADD CONSTRAINT "customer_accessories_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 2. CREATE NEW TABLE: style_garment_accessories
-- =====================================================
CREATE TABLE "style_garment_accessories" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "accessoryName" TEXT NOT NULL,
    "accessoryType" TEXT,
    "specification" TEXT,
    "quantityPerPiece" INTEGER,
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_garment_accessories_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "style_garment_accessories_styleId_idx" ON "style_garment_accessories"("styleId");

-- Add foreign key constraint
ALTER TABLE "style_garment_accessories" ADD CONSTRAINT "style_garment_accessories_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 3. CREATE NEW TABLE: style_packaging_accessories
-- =====================================================
CREATE TABLE "style_packaging_accessories" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT,
    "specification" TEXT,
    "quantityPerPack" INTEGER,
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_packaging_accessories_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "style_packaging_accessories_styleId_idx" ON "style_packaging_accessories"("styleId");

-- Add foreign key constraint
ALTER TABLE "style_packaging_accessories" ADD CONSTRAINT "style_packaging_accessories_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 4. EXTEND STYLES TABLE WITH NEW FIELDS
-- =====================================================

-- Additional Details (from bulk import)
ALTER TABLE "styles" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "styles" ADD COLUMN "accountingSKU" TEXT;
ALTER TABLE "styles" ADD COLUMN "accountingUnit" TEXT;
ALTER TABLE "styles" ADD COLUMN "productTaxRule" TEXT;
ALTER TABLE "styles" ADD COLUMN "mrp" DECIMAL(10,2);
ALTER TABLE "styles" ADD COLUMN "bulletPoints" TEXT;

-- Production Method Classification
ALTER TABLE "styles" ADD COLUMN "productionMethod" TEXT CHECK ("productionMethod" IN ('DYED_ONLY', 'PRINTED_ONLY', 'MIXED'));

-- Mandatory Process Flags (Pre-checked, no costs at style level)
ALTER TABLE "styles" ADD COLUMN "hasCutting" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "styles" ADD COLUMN "hasStitching" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "styles" ADD COLUMN "hasFinishing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "styles" ADD COLUMN "hasTransportation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "styles" ADD COLUMN "hasWashing" BOOLEAN NOT NULL DEFAULT false;

-- CAD Approval Status
ALTER TABLE "styles" ADD COLUMN "cadStatus" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("cadStatus" IN ('PENDING', 'IN_PROGRESS', 'APPROVED'));
ALTER TABLE "styles" ADD COLUMN "approvedCadId" TEXT;

-- Create index for CAD status filtering
CREATE INDEX "styles_cadStatus_idx" ON "styles"("cadStatus");

-- =====================================================
-- 5. EXTEND STYLE_COMPONENTS TABLE
-- =====================================================
ALTER TABLE "style_components" ADD COLUMN "productionMethod" TEXT CHECK ("productionMethod" IN ('DYED', 'PRINTED', 'MIXED'));

-- =====================================================
-- 6. DATA MIGRATION FOR EXISTING RECORDS
-- =====================================================

-- Set default values for existing styles
UPDATE "styles"
SET
    "hasCutting" = true,
    "hasStitching" = true,
    "hasFinishing" = true,
    "hasTransportation" = true,
    "hasWashing" = false,
    "cadStatus" = 'PENDING'
WHERE "hasCutting" IS NULL;

-- Migrate existing style_garment_trims to style_garment_accessories
INSERT INTO "style_garment_accessories" (
    "id",
    "styleId",
    "accessoryName",
    "accessoryType",
    "specification",
    "quantityPerPiece",
    "isFromCustomer",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "styleId",
    "trimName" as "accessoryName",
    "trimType" as "accessoryType",
    NULL as "specification",
    "quantityPerPiece",
    false as "isFromCustomer",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "style_garment_trims"
WHERE NOT EXISTS (
    SELECT 1 FROM "style_garment_accessories" sga
    WHERE sga."styleId" = "style_garment_trims"."styleId"
    AND sga."accessoryName" = "style_garment_trims"."trimName"
);

-- Migrate existing style_packaging to style_packaging_accessories
INSERT INTO "style_packaging_accessories" (
    "id",
    "styleId",
    "itemName",
    "itemType",
    "specification",
    "quantityPerPack",
    "isFromCustomer",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid() as "id",
    "styleId",
    "itemName",
    "itemType",
    "specification",
    "quantityPerPack",
    false as "isFromCustomer",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "style_packaging"
WHERE NOT EXISTS (
    SELECT 1 FROM "style_packaging_accessories" spa
    WHERE spa."styleId" = "style_packaging"."styleId"
    AND spa."itemName" = "style_packaging"."itemName"
);

-- =====================================================
-- 7. CREATE COMMENT DOCUMENTATION
-- =====================================================
COMMENT ON TABLE "customer_accessories" IS 'Pre-defined garment and packaging accessories for each customer';
COMMENT ON TABLE "style_garment_accessories" IS 'Garment accessories for a specific style (buttons, zippers, etc.)';
COMMENT ON TABLE "style_packaging_accessories" IS 'Packaging accessories for a specific style (polybags, hangtags, etc.)';
COMMENT ON COLUMN "styles"."cadStatus" IS 'CAD approval workflow status: PENDING → IN_PROGRESS → APPROVED';
COMMENT ON COLUMN "styles"."approvedCadId" IS 'Foreign key to fabric_width_cad when user approves a specific CAD width';
COMMENT ON COLUMN "styles"."productionMethod" IS 'Overall production classification for the style';
COMMENT ON COLUMN "style_components"."productionMethod" IS 'Production method for this specific component (DYED, PRINTED, or MIXED)';
