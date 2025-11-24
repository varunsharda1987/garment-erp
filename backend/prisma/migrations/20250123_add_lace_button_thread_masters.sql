-- Migration: Add Lace, Button, Thread master tables and material types
-- Phase 1: Material System Foundation

-- Step 1: Add new values to MaterialType enum
ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'LACE';
ALTER TYPE "MaterialType" ADD VALUE IF NOT EXISTS 'BUTTON';

-- Note: THREAD already exists in MaterialType enum, no need to add

-- Step 2: Create lace_master table
CREATE TABLE IF NOT EXISTS "lace_master" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "laceCode" TEXT NOT NULL UNIQUE,
    "laceName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "width" DECIMAL(10,2),
    "design" TEXT,
    "color" TEXT,
    "composition" TEXT,
    "pricePerMeter" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lace_master_supplier_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lace_master_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lace_master_laceCode_idx" ON "lace_master"("laceCode");
CREATE INDEX IF NOT EXISTS "lace_master_supplierId_idx" ON "lace_master"("supplierId");

-- Step 3: Create button_master table
CREATE TABLE IF NOT EXISTS "button_master" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "buttonCode" TEXT NOT NULL UNIQUE,
    "buttonName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "size" TEXT,
    "holes" INTEGER,
    "color" TEXT,
    "material" TEXT,
    "shape" TEXT,
    "pricePerPiece" DECIMAL(10,2),
    "pricePerGross" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "button_master_supplier_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "button_master_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "button_master_buttonCode_idx" ON "button_master"("buttonCode");
CREATE INDEX IF NOT EXISTS "button_master_supplierId_idx" ON "button_master"("supplierId");

-- Step 4: Create thread_master table
CREATE TABLE IF NOT EXISTS "thread_master" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "threadCode" TEXT NOT NULL UNIQUE,
    "threadName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "buyerCode" TEXT,
    "threadCount" TEXT,
    "color" TEXT,
    "colorCode" TEXT,
    "composition" TEXT,
    "threadType" TEXT,
    "coneSize" TEXT,
    "pricePerCone" DECIMAL(10,2),
    "image" TEXT,
    "supplierId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_master_supplier_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "thread_master_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "thread_master_threadCode_idx" ON "thread_master"("threadCode");
CREATE INDEX IF NOT EXISTS "thread_master_supplierId_idx" ON "thread_master"("supplierId");

-- Step 5: Add new foreign key columns to materials table
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "laceId" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "buttonId" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

-- Step 6: Create foreign key constraints on materials table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'materials_laceId_fkey'
    ) THEN
        ALTER TABLE "materials" ADD CONSTRAINT "materials_laceId_fkey"
            FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'materials_buttonId_fkey'
    ) THEN
        ALTER TABLE "materials" ADD CONSTRAINT "materials_buttonId_fkey"
            FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'materials_threadId_fkey'
    ) THEN
        ALTER TABLE "materials" ADD CONSTRAINT "materials_threadId_fkey"
            FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 7: Create indexes on new foreign key columns
CREATE INDEX IF NOT EXISTS "materials_laceId_idx" ON "materials"("laceId");
CREATE INDEX IF NOT EXISTS "materials_buttonId_idx" ON "materials"("buttonId");
CREATE INDEX IF NOT EXISTS "materials_threadId_idx" ON "materials"("threadId");

-- Step 8: Seed material categories if they don't exist
DO $$
DECLARE
    trims_category_id TEXT;
BEGIN
    -- Check if Trims category exists, if not create it
    SELECT id INTO trims_category_id FROM material_categories WHERE name = 'Trims' LIMIT 1;

    IF trims_category_id IS NULL THEN
        INSERT INTO material_categories (id, name, description, "parentCategoryId", level, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'Trims', 'Trims and accessories', NULL, 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id INTO trims_category_id;
    END IF;

    -- Create Lace subcategory if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM material_categories WHERE name = 'Lace') THEN
        INSERT INTO material_categories (id, name, description, "parentCategoryId", level, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'Lace', 'Lace materials', trims_category_id, 2, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;

    -- Create Buttons subcategory if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM material_categories WHERE name = 'Buttons') THEN
        INSERT INTO material_categories (id, name, description, "parentCategoryId", level, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'Buttons', 'Button materials', trims_category_id, 2, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;

    -- Create Threads subcategory if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM material_categories WHERE name = 'Threads') THEN
        INSERT INTO material_categories (id, name, description, "parentCategoryId", level, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'Threads', 'Thread materials', trims_category_id, 2, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;
END $$;

-- Step 9: Add buyerStyleCode to styles table for consistency
ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "buyerStyleCode" TEXT;

COMMENT ON COLUMN "styles"."buyerStyleCode" IS 'Buyer or external reference code for the style (optional)';
