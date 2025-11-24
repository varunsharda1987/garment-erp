-- Migration: Add brand_categories table with hierarchical structure
-- This allows customers to define categories, sub-categories, and sub-sub-categories for their brands

-- Create brand_categories table
CREATE TABLE IF NOT EXISTS "brand_categories" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerId" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subCategory" TEXT,
  "subSubCategory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brand_categories_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX "brand_categories_customerId_idx" ON "brand_categories"("customerId");
CREATE INDEX "brand_categories_brandName_idx" ON "brand_categories"("brandName");

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX "brand_categories_customerId_brandName_category_subCategory_subSubCategory_key"
  ON "brand_categories"("customerId", "brandName", "category", "subCategory", "subSubCategory");

-- Add brandCategoryId to styles table
ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "brandCategoryId" TEXT;

-- Create index for brandCategoryId
CREATE INDEX IF NOT EXISTS "styles_brandCategoryId_idx" ON "styles"("brandCategoryId");

-- Add foreign key constraint
ALTER TABLE "styles"
  ADD CONSTRAINT "styles_brandCategoryId_fkey"
  FOREIGN KEY ("brandCategoryId") REFERENCES "brand_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Comments for documentation
COMMENT ON TABLE "brand_categories" IS 'Hierarchical categories for customer brands (category > sub-category > sub-sub-category)';
COMMENT ON COLUMN "brand_categories"."category" IS 'Main category (e.g., Mens Wear, Womens Wear, Kids Wear)';
COMMENT ON COLUMN "brand_categories"."subCategory" IS 'Sub-category (e.g., T-Shirts, Shirts, Trousers)';
COMMENT ON COLUMN "brand_categories"."subSubCategory" IS 'Sub-sub-category (e.g., Polo, V-Neck, Round Neck)';
