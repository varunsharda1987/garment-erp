-- Drop the deprecated cad_averages table
-- All data should be migrated to fabric_width_cad before running this migration
-- Run the migration script: backend/src/scripts/migrate-cad-averages-to-fabric-width-cad.ts first

-- WARNING: This is a destructive operation
-- Make sure you have backed up all cad_averages data before proceeding

-- Step 1: Remove the foreign key constraint from style_fabrics (if it still exists)
-- This ensures we can drop the table cleanly

-- Step 2: Drop the cad_averages table
DROP TABLE IF EXISTS "cad_averages" CASCADE;

-- Verification queries (run these manually after migration):
-- SELECT COUNT(*) FROM fabric_width_cad;  -- Should have CAD records
-- SELECT COUNT(*) FROM style_fabrics WHERE "fabricCADId" IS NOT NULL;  -- Should have linked records
