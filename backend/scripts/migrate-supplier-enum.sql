-- Migrate SupplierCategory enum to align with Material Categories
-- Step 1: Add new enum values
ALTER TYPE "SupplierCategory" ADD VALUE IF NOT EXISTS 'TRIMS_SUPPLIER';
ALTER TYPE "SupplierCategory" ADD VALUE IF NOT EXISTS 'THREAD_SUPPLIER';
ALTER TYPE "SupplierCategory" ADD VALUE IF NOT EXISTS 'PACKAGING_SUPPLIER';
ALTER TYPE "SupplierCategory" ADD VALUE IF NOT EXISTS 'OTHER_SERVICES';

-- Step 2: Migrate existing data
UPDATE suppliers
SET "supplierCategory" = 'TRIMS_SUPPLIER'
WHERE "supplierCategory" = 'TRIMS_ACCESSORIES';

UPDATE suppliers
SET "supplierCategory" = 'PACKAGING_SUPPLIER'
WHERE "supplierCategory" = 'PACKAGING';

-- Step 3: Create new enum without old values
CREATE TYPE "SupplierCategory_new" AS ENUM (
  'FABRIC_SUPPLIER',
  'TRIMS_SUPPLIER',
  'THREAD_SUPPLIER',
  'PACKAGING_SUPPLIER',
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'CMT_UNIT',
  'OTHER_SERVICES'
);

-- Step 4: Alter column to use new enum
ALTER TABLE suppliers
ALTER COLUMN "supplierCategory" TYPE "SupplierCategory_new"
USING ("supplierCategory"::text::"SupplierCategory_new");

-- Step 5: Drop old enum and rename new one
DROP TYPE "SupplierCategory";
ALTER TYPE "SupplierCategory_new" RENAME TO "SupplierCategory";
