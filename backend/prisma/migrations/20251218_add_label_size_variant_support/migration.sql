-- Migration: Add size variant support to materials table
-- This allows label size variants to have individual stock tracking through the materials system

-- Step 1: Add sizeVariantId field to materials table
ALTER TABLE "materials" ADD COLUMN "sizeVariantId" TEXT;

-- Step 2: Add index for performance
CREATE INDEX "materials_sizeVariantId_idx" ON "materials"("sizeVariantId");

-- Step 3: Add foreign key constraint to label_size_variants
ALTER TABLE "materials"
ADD CONSTRAINT "materials_sizeVariantId_fkey"
FOREIGN KEY ("sizeVariantId")
REFERENCES "label_size_variants"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 4: Add unique constraint to prevent duplicate material entries for same size variant
-- Only one material record should exist per size variant
CREATE UNIQUE INDEX "materials_sizeVariantId_key" ON "materials"("sizeVariantId")
WHERE "sizeVariantId" IS NOT NULL;
