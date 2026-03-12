-- Add pricing columns to material_suppliers table
-- Consolidates supplier pricing from material_supplier_mapping (Int-based) into material_suppliers (UUID-based)

ALTER TABLE "material_suppliers" ADD COLUMN "supplierPrice" DECIMAL(15,2);
ALTER TABLE "material_suppliers" ADD COLUMN "leadTimeDays" INTEGER;
ALTER TABLE "material_suppliers" ADD COLUMN "moq" DECIMAL(15,4);
ALTER TABLE "material_suppliers" ADD COLUMN "moqUnit" TEXT;
ALTER TABLE "material_suppliers" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
