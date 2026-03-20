-- Add source field to fabric_master
ALTER TABLE "fabric_master" ADD COLUMN "source" TEXT;

-- Backfill: stock fabrics get STOCK, all others get STYLE_LINKED
UPDATE "fabric_master" SET "source" = 'STOCK' WHERE "isGeneric" = true;
UPDATE "fabric_master" SET "source" = 'STYLE_LINKED' WHERE "isGeneric" = false;
