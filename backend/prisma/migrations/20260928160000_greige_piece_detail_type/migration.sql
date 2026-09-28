-- Rolls are rolls (2026-09-28): a greige piece records whether it is a THAN or a ROLL. Before this, the 87
-- rolls on the 7 roll-wise greige lots read as "thans in 1 bale" on every issue screen and challan.
ALTER TABLE "greige_stock_details" ADD COLUMN "detailType" VARCHAR(10) NOT NULL DEFAULT 'THAN';

-- Backfill: a lot's pieces are rolls when its GRN line was entered roll-wise (one line = one entry mode).
UPDATE "greige_stock_details" AS d
SET "detailType" = 'ROLL'
FROM "greige_stock" AS s
JOIN "grn_items" AS gi ON gi."id" = s."grnItemId"
WHERE d."greigeStockId" = s."id"
  AND (
    gi."entryMode" = 'ROLL_WISE'
    OR EXISTS (
      SELECT 1 FROM "grn_item_details" AS gd
      WHERE gd."grnItemId" = gi."id" AND gd."detailType" = 'ROLL'
    )
  );
