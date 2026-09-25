-- Goods delivered straight to a processor (direct-to-processor plan, Phase 2, 2026-09-25).
-- 1. challans.directSupplyGrnId: the OUTWARD Rule 45 challan we issue for inputs a supplier delivered
--    STRAIGHT to a job worker names the purchase receipt it covers. Distinct from challans.grnId (the
--    INWARD receipt part of a job-work return).
-- 2. derived_stock_view: greige with sourceType 'DIRECT' (bought, held by the processor it was delivered
--    to) stays ON-HAND at that processor's unit — it was never in our store, and stock_levels books it
--    there at GRN approval. The whole view is recreated from the live definition; only the greige
--    condition changes. No DIRECT lot exists before this migration, so no figure moves.

-- AlterTable
ALTER TABLE "challans" ADD COLUMN     "directSupplyGrnId" TEXT;

-- CreateIndex
CREATE INDEX "challans_directSupplyGrnId_idx" ON "challans"("directSupplyGrnId");

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_directSupplyGrnId_fkey" FOREIGN KEY ("directSupplyGrnId") REFERENCES "goods_receiving_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreate derived_stock_view (live definition, greige condition extended by OR sourceType = 'DIRECT')
CREATE OR REPLACE VIEW derived_stock_view AS
 WITH per_lot AS (
         SELECT m.id AS "materialId",
            s."warehouseId",
            sum(s."quantityAvailable") AS quantity,
            max(s."updatedAt") AS last_updated
           FROM greige_stock s
             JOIN materials m ON m."greigeId" = s."greigeId"::text
          WHERE s."warehouseId" IS NOT NULL AND ((s."processorId" IS NULL AND s."sourceType"::text IS DISTINCT FROM 'TRANSFER'::text) OR s."sourceType"::text = 'DIRECT'::text)
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
             JOIN materials m ON m."labelId" = s."labelId"
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
