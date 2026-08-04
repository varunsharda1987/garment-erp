-- Step 1: Migrate existing data from old values to new values across ALL tables using MaterialType
UPDATE "materials" SET "materialType" = 'FABRIC' WHERE "materialType" = 'FINISHED_FABRIC';
UPDATE "materials" SET "materialType" = 'GREIGE' WHERE "materialType" = 'GREIGE_FABRIC';
UPDATE "style_material_bom" SET "materialType" = 'FABRIC' WHERE "materialType" = 'FINISHED_FABRIC';
UPDATE "style_material_bom" SET "materialType" = 'GREIGE' WHERE "materialType" = 'GREIGE_FABRIC';
UPDATE "customer_accessories_preset_items" SET "materialType" = 'FABRIC' WHERE "materialType" = 'FINISHED_FABRIC';
UPDATE "customer_accessories_preset_items" SET "materialType" = 'GREIGE' WHERE "materialType" = 'GREIGE_FABRIC';
UPDATE "material_master" SET "materialType" = 'FABRIC' WHERE "materialType" = 'FINISHED_FABRIC';
UPDATE "material_master" SET "materialType" = 'GREIGE' WHERE "materialType" = 'GREIGE_FABRIC';

-- Step 2: Drop defaults before changing enum type
ALTER TABLE "materials" ALTER COLUMN "materialType" DROP DEFAULT;
ALTER TABLE "style_material_bom" ALTER COLUMN "materialType" DROP DEFAULT;
ALTER TABLE "customer_accessories_preset_items" ALTER COLUMN "materialType" DROP DEFAULT;
ALTER TABLE "material_master" ALTER COLUMN "materialType" DROP DEFAULT;

-- Step 3: Rename old enum
ALTER TYPE "MaterialType" RENAME TO "MaterialType_old";

-- Step 4: Create new enum without FINISHED_FABRIC and GREIGE_FABRIC
CREATE TYPE "MaterialType" AS ENUM (
  'GENERIC', 'TRIMS', 'LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC',
  'LABEL', 'PACKAGING', 'ACCESSORIES', 'SERVICE', 'MACHINE_PART', 'OTHER',
  'FABRIC', 'GREIGE', 'HOOK_EYE', 'SNAP_BUTTON', 'BUCKLE', 'BELT',
  'VELCRO', 'DRAWSTRING', 'RIBBON', 'SEQUIN', 'BEAD', 'MOTIF',
  'INTERLINING', 'PADDING', 'OTHER_FASTENER', 'OTHER_TAPE',
  'OTHER_DECORATIVE', 'OTHER_FUNCTIONAL', 'OTHER_MATERIAL'
);

-- Step 5: Convert all columns to new enum
ALTER TABLE "materials" ALTER COLUMN "materialType" TYPE "MaterialType" USING "materialType"::text::"MaterialType";
ALTER TABLE "style_material_bom" ALTER COLUMN "materialType" TYPE "MaterialType" USING "materialType"::text::"MaterialType";
ALTER TABLE "customer_accessories_preset_items" ALTER COLUMN "materialType" TYPE "MaterialType" USING "materialType"::text::"MaterialType";
ALTER TABLE "material_master" ALTER COLUMN "materialType" TYPE "MaterialType" USING "materialType"::text::"MaterialType";

-- Step 6: Restore defaults
ALTER TABLE "materials" ALTER COLUMN "materialType" SET DEFAULT 'GENERIC';
ALTER TABLE "style_material_bom" ALTER COLUMN "materialType" SET DEFAULT 'GENERIC';
ALTER TABLE "customer_accessories_preset_items" ALTER COLUMN "materialType" SET DEFAULT 'GENERIC';
ALTER TABLE "material_master" ALTER COLUMN "materialType" SET DEFAULT 'GENERIC';

-- Step 7: Drop old enum
DROP TYPE "MaterialType_old";
