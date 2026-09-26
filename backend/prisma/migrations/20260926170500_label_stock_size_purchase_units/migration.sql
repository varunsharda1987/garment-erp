-- Label stock per size + purchase unit ≠ stock unit (2026-09-26, garment-erp-a5).
--
-- 1. label_stock.sizeVariantId: a sized label's lot records its size. derived_stock_view puts each label lot on
--    exactly ONE materials row (the size row, else the base row) — before, every label lot showed on the base
--    row AND on every size row. The view is recreated from the LIVE definition; only the label JOIN changes.
-- 2. purchase_order_items.stockUnitsPerUnit (+ threadPackagingType / threadPly): a PO line in a PURCHASE unit
--    (buttons by the GROSS = 144 pieces; thread by the BOX) carries how many stock units one holds.
-- 3. grn_items.stockQuantity: what approval booked into stock, so a reversal takes back exactly that.
-- 4. Per-stock-unit money to 4 dp: ₹18 / gross = ₹0.125 / piece.
-- The view reads stock_settings.valuationRate, so it is dropped before the type change and recreated after.

DROP VIEW IF EXISTS derived_stock_view;

-- AlterTable
ALTER TABLE "button_stock" ALTER COLUMN "purchaseCost" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "weightedAvgCost" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "stockQuantity" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "label_stock" ADD COLUMN     "sizeVariantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "stockUnitsPerUnit" DECIMAL(12,4),
ADD COLUMN     "threadPackagingType" "ThreadPackagingType",
ADD COLUMN     "threadPly" "ThreadPly";

-- AlterTable
ALTER TABLE "stock_levels" ALTER COLUMN "valuationRate" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "stock_settings" ALTER COLUMN "valuationRate" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "stock_transactions" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(12,4);

-- CreateIndex
CREATE INDEX "label_stock_sizeVariantId_idx" ON "label_stock"("sizeVariantId");

-- AddForeignKey
ALTER TABLE "label_stock" ADD CONSTRAINT "label_stock_sizeVariantId_fkey" FOREIGN KEY ("sizeVariantId") REFERENCES "label_size_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A GROSS line is 144 pieces; a BOX line must say how many it holds.
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_item_gross_is_144" CHECK ("unit" <> 'GROSS' OR "stockUnitsPerUnit" = 144);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_item_box_has_size" CHECK ("unit" <> 'BOX' OR "stockUnitsPerUnit" IS NOT NULL);

CREATE VIEW derived_stock_view AS
 WITH per_lot AS (
         SELECT m.id AS "materialId",
            s."warehouseId",
            sum(s."quantityAvailable") AS quantity,
            max(s."updatedAt") AS last_updated
           FROM greige_stock s
             JOIN materials m ON m."greigeId" = s."greigeId"::text
          WHERE s."warehouseId" IS NOT NULL AND (s."processorId" IS NULL AND s."sourceType"::text IS DISTINCT FROM 'TRANSFER'::text OR s."sourceType"::text = 'DIRECT'::text)
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM fabric_stock s
             JOIN materials m ON m."fabricId" = s."fabricId"
             JOIN fabric_master fm ON fm.id = s."fabricId"
          WHERE s."warehouseId" IS NOT NULL AND NOT (fm."finishType" = 'RAW'::"FabricFinishType" OR fm."isGeneric" = true OR fm."fabricCode" ~~ '%-RAW'::text)
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM lace_stock s
             JOIN materials m ON m."laceId" = s."laceId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM thread_stock s
             JOIN materials m ON m."threadId" = s."threadId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM button_stock s
             JOIN materials m ON m."buttonId" = s."buttonId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM zipper_stock s
             JOIN materials m ON m."zipperId" = s."zipperId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM elastic_stock s
             JOIN materials m ON m."elasticId" = s."elasticId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM label_stock s
             JOIN materials m ON m."labelId" = s."labelId" AND NOT m."sizeVariantId" IS DISTINCT FROM s."sizeVariantId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM packaging_stock s
             JOIN materials m ON m."packagingId" = s."packagingId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM machine_part_stock s
             JOIN materials m ON m."machinePartId" = s."machinePartId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        UNION ALL
         SELECT m.id,
            s."warehouseId",
            sum(s."quantityAvailable") AS sum,
            max(s."updatedAt") AS max
           FROM other_material_stock s
             JOIN materials m ON m."otherMaterialId" = s."otherMaterialId"
          WHERE s."warehouseId" IS NOT NULL
          GROUP BY m.id, s."warehouseId"
        ), agg AS (
         SELECT per_lot."materialId",
            per_lot."warehouseId",
            sum(per_lot.quantity) AS quantity,
            max(per_lot.last_updated) AS last_updated
           FROM per_lot
          GROUP BY per_lot."materialId", per_lot."warehouseId"
        )
 SELECT a."materialId",
    a."warehouseId",
    a.quantity,
    ss."reorderLevel",
    ss."minLevel",
    ss."maxLevel",
    ss."valuationRate",
    round(a.quantity * COALESCE(ss."valuationRate", 0::numeric), 2) AS "stockValue",
    a.last_updated AS "lastUpdated"
   FROM agg a
     LEFT JOIN stock_settings ss ON ss."materialId" = a."materialId" AND ss."warehouseId" = a."warehouseId"::text;
